import { createAthleteStatsAdherenceSource } from '@/lib/athlete-stats/athlete-stats-adherence-source'
import { createAthleteStatsCompetitionSource } from '@/lib/athlete-stats/athlete-stats-competition-source'
import { createAthleteStatsTrainingSources } from '@/lib/athlete-stats/athlete-stats-production-sources'
import type { AthleteStatsSourceDependencies } from '@/lib/athlete-stats/athlete-stats-source-adapter'

export interface AthleteStatsProductionSourceGroups {
  readonly training: Pick<AthleteStatsSourceDependencies, 'listRealizedTraining' | 'getTrainingLoad'>
  readonly adherence: Pick<AthleteStatsSourceDependencies, 'getAdherence'>
  readonly competition: Pick<AthleteStatsSourceDependencies, 'getCompetitionContext'>
}

/** Assembles the complete production source surface consumed by Stats Analytics. */
export function createAthleteStatsProductionSources(
  groups: AthleteStatsProductionSourceGroups = {
    training: createAthleteStatsTrainingSources(),
    adherence: createAthleteStatsAdherenceSource(),
    competition: createAthleteStatsCompetitionSource(),
  },
): AthleteStatsSourceDependencies {
  return {
    ...groups.training,
    ...groups.adherence,
    ...groups.competition,
  }
}
