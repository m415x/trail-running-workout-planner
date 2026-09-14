'use server'

import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { db } from '@/db'
import {
  groupSessionPrescriptions,
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
  sessions,
  workoutLogs,
} from '@/db/schema'
import { workoutLogEvidence } from '@/db/readiness-schema'
import { getAthleteById } from '@/app/actions/athlete-actions'
import { getAthletePlanningResolutionOnDate } from '@/app/actions/planning-cohort-actions'
import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import {
  correctManualRealizedTrainingRecord,
  listRealizedTrainingCorrections,
} from '@/lib/realized-training/realized-training-correction-repository'
import {
  createManualRealizedTrainingRecord,
  listRealizedTrainingRecordsForAthlete,
  listRealizedTrainingRecordsForAthleteInDateRange,
} from '@/lib/realized-training/realized-training-repository'
import {
  hasUnplannedTrainingOnDate,
  reconcileTrainingDayStatus,
} from '@/lib/realized-training/day-status-reconciliation'
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
 * Athlete-facing calendar boundary for one explicit date range. The current
 * athlete/team are resolved on the server and records come from the same durable
 * repository used by readiness; planned sessions are never treated as realized
 * evidence here.
 */
export async function getCurrentAthleteRealizedTrainingRangeAction(startDate: string, endDate: string) {
  if (startDate > endDate) return { success: false as const, data: [] }

  const current = await getCurrentAthlete()
  const athlete = current.success ? current.data?.athleteProfile : null
  if (!athlete || athlete.isDeleted) return { success: false as const, data: [] }

  return {
    success: true as const,
    data: listRealizedTrainingRecordsForAthleteInDateRange(
      athlete.id,
      athlete.teamId,
      startDate,
      endDate,
    ),
  }
}


export interface RealizedTrainingCalendarSession {
  readonly id: string
  readonly date: string
  readonly title: string
  readonly recordId: string | null
  readonly status: 'completed' | 'partial' | 'missed' | 'pending' | 'rest'
}

export interface RealizedTrainingCalendarDay {
  readonly date: string
  readonly sessions: readonly RealizedTrainingCalendarSession[]
  readonly unplannedRecordIds: readonly string[]
}

/**
 * Builds the coach-facing calendar projection from applicable prescribed
 * sessions and the same durable evidence used by history/readiness. A missing
 * linked row can make a past prescribed session currently `missed`, but does
 * not create realized evidence or infer a permanent athlete assertion.
 */
export async function getRealizedTrainingCalendarForAthleteAction(
  athleteId: string,
  startDate: string,
  endDate: string,
  today: string,
) {
  if (startDate > endDate) return { success: false as const, data: [] }

  const athlete = await getAthleteById(athleteId)
  if (!athlete) return { success: false as const, data: [] }

  const [records, candidateSessions] = await Promise.all([
    Promise.resolve(listRealizedTrainingRecordsForAthleteInDateRange(
      athlete.id,
      athlete.teamId,
      startDate,
      endDate,
    )),
    Promise.resolve(db
      .select({
        id: sessions.id,
        date: sessions.date,
        title: sessions.title,
        planId: groupTrainingPlans.id,
      })
      .from(sessions)
      .innerJoin(
        groupSessionPrescriptions,
        and(
          eq(groupSessionPrescriptions.sessionId, sessions.id),
          eq(groupSessionPrescriptions.isDeleted, false),
        ),
      )
      .innerJoin(microcycles, eq(groupSessionPrescriptions.microcycleId, microcycles.id))
      .innerJoin(mesocycles, eq(microcycles.mesocycleId, mesocycles.id))
      .innerJoin(macrocycles, eq(mesocycles.macrocycleId, macrocycles.id))
      .innerJoin(groupTrainingPlans, eq(macrocycles.groupTrainingPlanId, groupTrainingPlans.id))
      .where(and(
        eq(sessions.teamId, athlete.teamId),
        gte(sessions.date, startDate),
        lte(sessions.date, endDate),
        eq(sessions.isDeleted, false),
        eq(microcycles.isDeleted, false),
        eq(mesocycles.isDeleted, false),
        eq(macrocycles.isDeleted, false),
        eq(groupTrainingPlans.isDeleted, false),
      ))
      .all()),
  ])

  const dates = [...new Set(candidateSessions.map(session => session.date))]
  const resolutions = await Promise.all(dates.map(async date => [
    date,
    await getAthletePlanningResolutionOnDate(athlete.id, date),
  ] as const))
  const planIdByDate = new Map(resolutions.map(([date, result]) => [
    date,
    result?.resolution.status === 'resolved' ? result.resolution.planId : null,
  ]))

  const sessionsByDate = new Map<string, RealizedTrainingCalendarSession[]>()
  for (const session of candidateSessions) {
    if (planIdByDate.get(session.date) !== session.planId) continue

    const linkedRecords = records.filter(record => record.sessionId === session.id)
    const matchedRecord = linkedRecords.find(record => record.status === 'completed')
      ?? linkedRecords.find(record => record.status === 'partial')
      ?? null
    const matchedEvidenceOutcome = matchedRecord?.status === 'completed'
      ? 'completed' as const
      : matchedRecord?.status === 'partial'
        ? 'partial' as const
        : null
    const entries = sessionsByDate.get(session.date) ?? []
    entries.push({
      id: session.id,
      date: session.date,
      title: session.title,
      recordId: matchedRecord?.id ?? null,
      status: reconcileTrainingDayStatus({
        date: session.date,
        today,
        hasPlannedSession: true,
        matchedEvidenceOutcome,
      }),
    })
    sessionsByDate.set(session.date, entries)
  }

  const datesWithEvidence = [...new Set(records.map(record => record.date))]
  const calendarDates = [...new Set([...dates, ...datesWithEvidence])].sort()

  return {
    success: true as const,
    data: calendarDates.map(date => ({
      date,
      sessions: sessionsByDate.get(date) ?? [],
      unplannedRecordIds: hasUnplannedTrainingOnDate(records, date)
        ? records.filter(record => record.date === date && record.sessionId === null).map(record => record.id)
        : [],
    })),
  }
}

/**
 * Coach-facing history boundary. Athlete lookup enforces the current team before
 * any realized evidence is returned, and the repository receives that same team
 * scope as a second line of defense.
 */
export async function getRealizedTrainingHistoryForAthleteAction(athleteId: string) {
  const athlete = await getAthleteById(athleteId)
  if (!athlete) return { success: false as const, data: [] }

  return {
    success: true as const,
    data: listRealizedTrainingRecordsForAthlete(athlete.id, athlete.teamId),
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
