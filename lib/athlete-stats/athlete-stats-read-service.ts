import {
  projectAthleteStatsDetails,
  projectAthleteStatsSummary,
  type AthleteStatsDetails,
  type AthleteStatsProjectionInput,
  type AthleteStatsSummary,
} from '@/lib/athlete-stats/athlete-stats-projections'

export interface AthleteStatsSubject {
  readonly athleteId: string
  readonly teamId: string
}

export type AthleteStatsReadRequest = {
  readonly startDate: string
  readonly endDate: string
  readonly view: 'summary' | 'details'
}

export interface AthleteStatsReadDependencies {
  readonly resolveCurrentAthlete: () => Promise<AthleteStatsSubject | null>
  readonly loadProjectionInput: (
    subject: AthleteStatsSubject,
    period: { readonly startDate: string; readonly endDate: string },
  ) => Promise<AthleteStatsProjectionInput>
}

export type AthleteStatsReadResult =
  | { readonly status: 'success'; readonly data: AthleteStatsSummary | AthleteStatsDetails }
  | { readonly status: 'error'; readonly code: 'invalid_period' | 'current_athlete_unavailable' | 'stats_read_failed' }

/**
 * Application read boundary for Athlete Stats. The caller supplies only a
 * period/view; athlete and team scope are resolved server-side.
 */
export async function readCurrentAthleteStats(
  request: AthleteStatsReadRequest,
  dependencies: AthleteStatsReadDependencies,
): Promise<AthleteStatsReadResult> {
  if (request.startDate > request.endDate) {
    return { status: 'error', code: 'invalid_period' }
  }

  try {
    const subject = await dependencies.resolveCurrentAthlete()
    if (!subject) return { status: 'error', code: 'current_athlete_unavailable' }

    const input = await dependencies.loadProjectionInput(subject, {
      startDate: request.startDate,
      endDate: request.endDate,
    })

    return {
      status: 'success',
      data: request.view === 'summary'
        ? projectAthleteStatsSummary(input)
        : projectAthleteStatsDetails(input),
    }
  } catch {
    return { status: 'error', code: 'stats_read_failed' }
  }
}
