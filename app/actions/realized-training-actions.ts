'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { workoutLogs } from '@/db/schema'
import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { createManualRealizedTrainingRecord } from '@/lib/realized-training/realized-training-repository'
import type { ManualRealizedTrainingClientInput } from '@/types/training/realized-training-capture.types'

/** Restore capture state on reload using the server-resolved athlete and exact Session ID. */
export async function getManualRealizedSessionStateAction(sessionId: string) {
  const current = await getCurrentAthlete()
  const athlete = current.success ? current.data?.athleteProfile : null
  if (!athlete || athlete.isDeleted) return { success: false as const }
  const row = db.select({ id: workoutLogs.id }).from(workoutLogs).where(and(
    eq(workoutLogs.athleteId, athlete.id), eq(workoutLogs.sessionId, sessionId),
    eq(workoutLogs.isDeleted, false), inArray(workoutLogs.status, ['completed', 'partial', 'missed']),
  )).get()
  return { success: true as const, captured: Boolean(row) }
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
