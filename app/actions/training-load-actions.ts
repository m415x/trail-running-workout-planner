'use server'

import { getAthleteById } from '@/app/actions/athlete-actions'
import { buildAthleteTrainingLoadState } from '@/lib/training-load/athlete-training-load'
import { listRealizedTrainingRecordsForAthleteInDateRange } from '@/lib/realized-training/realized-training-repository'

export async function getAthleteTrainingLoadAction(
  athleteId: string,
  startDate: string,
  endDate: string,
) {
  if (startDate > endDate) {
    return { success: false as const, data: null }
  }

  const athlete = await getAthleteById(athleteId)
  if (!athlete || athlete.isDeleted) {
    return { success: false as const, data: null }
  }

  const records = listRealizedTrainingRecordsForAthleteInDateRange(
    athlete.id,
    athlete.teamId,
    startDate,
    endDate,
  )

  return {
    success: true as const,
    data: buildAthleteTrainingLoadState({
      athleteId: athlete.id,
      startDate,
      endDate,
      records,
    }),
  }
}
