'use server'

import { getCurrentAthlete } from '@/app/actions/dashboard-actions'
import { createManualRealizedTrainingRecord } from '@/lib/realized-training/realized-training-repository'
import type { ManualRealizedTrainingClientInput } from '@/types/training/realized-training-capture.types'

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
