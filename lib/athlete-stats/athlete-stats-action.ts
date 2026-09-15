import {
  readCurrentAthleteStats,
  type AthleteStatsReadDependencies,
  type AthleteStatsReadRequest,
} from '@/lib/athlete-stats/athlete-stats-read-service'

interface CurrentAthleteResult {
  readonly success: boolean
  readonly data?: {
    readonly athleteProfile?: {
      readonly id: string
      readonly teamId: string
      readonly isDeleted: boolean
    } | null
  } | null
}

export interface AthleteStatsActionDependencies {
  readonly getCurrentAthlete: () => Promise<CurrentAthleteResult>
  readonly loadProjectionInput: AthleteStatsReadDependencies['loadProjectionInput']
}

/**
 * Builds the athlete-facing Stats action without accepting an athleteId from
 * the client. The current development identity boundary remains explicit and
 * replaceable when authenticated subject resolution is introduced.
 */
export function createAthleteStatsAction(dependencies: AthleteStatsActionDependencies) {
  return async function getCurrentAthleteStatsAction(request: AthleteStatsReadRequest) {
    return readCurrentAthleteStats(request, {
      resolveCurrentAthlete: async () => {
        const current = await dependencies.getCurrentAthlete()
        const athlete = current.success ? current.data?.athleteProfile : null
        if (!athlete || athlete.isDeleted) return null

        return { athleteId: athlete.id, teamId: athlete.teamId }
      },
      loadProjectionInput: dependencies.loadProjectionInput,
    })
  }
}
