import {
  readCurrentAthleteStats,
  type AthleteStatsReadDependencies,
  type AthleteStatsReadRequest,
  type AthleteStatsSubject,
} from '@/lib/athlete-stats/athlete-stats-read-service'

export interface AthleteStatsActionDependencies {
  readonly resolveCurrentAthlete: () => Promise<AthleteStatsSubject | null>
  readonly loadProjectionInput: AthleteStatsReadDependencies['loadProjectionInput']
}

/** Pure Stats adapter: production must supply an already authorized H5B subject. */
export function createAthleteStatsAction(dependencies: AthleteStatsActionDependencies) {
  return async function getCurrentAthleteStatsAction(request: AthleteStatsReadRequest) {
    return readCurrentAthleteStats(request, {
      resolveCurrentAthlete: dependencies.resolveCurrentAthlete,
      loadProjectionInput: dependencies.loadProjectionInput,
    })
  }
}
