'use server'

import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { workoutLogs } from '@/db/schema'
import { workoutLogEvidence } from '@/db/readiness-schema'
import { getAthleteById } from '@/app/actions/athlete-actions'
import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import {
  correctManualRealizedTrainingRecord,
  listRealizedTrainingCorrections,
} from '@/lib/realized-training/realized-training-correction-repository'
import {
  createManualRealizedTrainingRecord,
  listRealizedTrainingRecordsForAthlete,
} from '@/lib/realized-training/realized-training-repository'
import { mapPersistenceToManualRealizedTrainingClientInput } from '@/lib/realized-training/persistence-mapping'
import type { ManualRealizedTrainingClientInput } from '@/types/training/realized-training-capture.types'
import type { ManualRealizedTrainingCorrectionClientInput } from '@/types/training/realized-training-correction.types'

/**
 * Restores capture state on reload using the server-resolved athlete and exact
 * Session ID. Only durable manual evidence with enough provenance is exposed as
 * editable input; legacy/imported rows remain captured but read-only.
 */
export async function getManualRealizedSessionStateAction(sessionId: string) {
  const current = await getCurrentAthlete()
  const athlete = current.success ? current.data?.athleteProfile : null
  if (!athlete || athlete.isDeleted) return { success: false as const }

  const row = db
    .select({ log: workoutLogs, evidence: workoutLogEvidence })
    .from(workoutLogs)
    .leftJoin(workoutLogEvidence, eq(workoutLogEvidence.workoutLogId, workoutLogs.id))
    .where(and(
      eq(workoutLogs.athleteId, athlete.id),
      eq(workoutLogs.sessionId, sessionId),
      eq(workoutLogs.isDeleted, false),
      inArray(workoutLogs.status, ['completed', 'partial', 'missed']),
    ))
    .orderBy(desc(workoutLogs.loggedAt))
    .get()

  if (!row) {
    return {
      success: true as const,
      captured: false,
      workoutLogId: null,
      editableInput: null,
    }
  }

  return {
    success: true as const,
    captured: true,
    workoutLogId: row.log.id,
    editableInput: mapPersistenceToManualRealizedTrainingClientInput({
      log: row.log,
      evidence: row.evidence,
    }),
  }
}

/**
 * Coach-facing history boundary. Athlete lookup enforces the current team before
 * any realized evidence is returned, so an arbitrary athlete ID cannot cross teams.
 */
export async function getRealizedTrainingHistoryForAthleteAction(athleteId: string) {
  const athlete = await getAthleteById(athleteId)
  if (!athlete) return { success: false as const, data: [] }

  return {
    success: true as const,
    data: listRealizedTrainingRecordsForAthlete(athlete.id),
  }
}

/**
 * Returns correction provenance only after the parent workout log is proven to
 * belong to the requested athlete in the current coach team.
 */
export async function getRealizedTrainingCorrectionsAction(athleteId: string, workoutLogId: string) {
  const athlete = await getAthleteById(athleteId)
  if (!athlete) return { success: false as const, data: [] }

  const ownedLog = db.select({ id: workoutLogs.id }).from(workoutLogs).where(and(
    eq(workoutLogs.id, workoutLogId),
    eq(workoutLogs.athleteId, athlete.id),
    eq(workoutLogs.isDeleted, false),
  )).get()
  if (!ownedLog) return { success: false as const, data: [] }

  return { success: true as const, data: listRealizedTrainingCorrections(workoutLogId) }
}

export async function createManualRealizedTrainingAction(
  input: ManualRealizedTrainingClientInput,
) {
  const current = await getCurrentAthlete()
  const athleteId = current.success ? current.data?.athleteProfile?.id : null

  if (!athleteId) {
    return {
      success: false as const,
      error: 'athlete_not_found',
    }
  }

  try {
    const record = createManualRealizedTrainingRecord({
      ...input,
      athleteId,
    })

    return {
      success: true as const,
      data: record,
    }
  } catch (error) {
    console.error('Error persisting realized training:', error)

    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'realized_training_persistence_failed',
    }
  }
}

/**
 * Athlete-facing correction boundary. Athlete and actor identity are resolved
 * from the current server context; callers cannot correct another athlete's log
 * or forge the audit actor.
 */
export async function correctManualRealizedTrainingAction(
  input: ManualRealizedTrainingCorrectionClientInput,
) {
  const current = await getCurrentAthlete()
  const currentUser = current.success ? current.data : null
  const athlete = currentUser?.athleteProfile ?? null

  if (!currentUser || !athlete || athlete.isDeleted) {
    return { success: false as const, error: 'athlete_not_found' }
  }

  try {
    const record = correctManualRealizedTrainingRecord({
      ...input,
      athleteId: athlete.id,
      correctedByUserId: currentUser.id,
    })
    return { success: true as const, data: record }
  } catch (error) {
    console.error('Error correcting realized training:', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'realized_training_correction_failed',
    }
  }
}