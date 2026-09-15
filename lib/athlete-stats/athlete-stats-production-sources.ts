import { listRealizedTrainingRecordsForAthleteInDateRange } from '@/lib/realized-training/realized-training-repository'
import { buildAthleteTrainingLoadState } from '@/lib/training-load/athlete-training-load'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

type SubjectPeriod = Parameters<AthleteStatsSourceDependencies['listRealizedTraining']>[0]

export interface AthleteStatsTrainingSourceDependencies {
  readonly listRealizedTrainingRecordsForAthleteInDateRange: (
    athleteId: string,
    teamId: string,
    startDate: string,
    endDate: string,
  ) => readonly RealizedTrainingRecord[]
}

const productionDependencies: AthleteStatsTrainingSourceDependencies = {
  listRealizedTrainingRecordsForAthleteInDateRange,
}

/**
 * Connects Athlete Stats training analytics to the durable H12 realized-training
 * boundary. KAN-344 load is derived from those same persisted records so the
 * athlete view cannot drift onto a second source of truth.
 */
export function createAthleteStatsTrainingSources(
  dependencies: AthleteStatsTrainingSourceDependencies = productionDependencies,
): Pick<AthleteStatsSourceDependencies, 'listRealizedTraining' | 'getTrainingLoad'> {
  const listRealizedTraining = async (input: SubjectPeriod) => (
    dependencies.listRealizedTrainingRecordsForAthleteInDateRange(
      input.athleteId,
      input.teamId,
      input.startDate,
      input.endDate,
    )
  )

  return {
    listRealizedTraining,
    getTrainingLoad: async (input) => {
      const records = await listRealizedTraining(input)
      return buildAthleteTrainingLoadState({
        athleteId: input.athleteId,
        startDate: input.startDate,
        endDate: input.endDate,
        records,
      })
    },
  }
}
