import type {
  PreCompetitionLoadContext,
  PreCompetitionLoadTrend,
  PreCompetitionWeekLoad,
} from '@/types'

export const DEFAULT_PRE_COMPETITION_REFERENCE_WEEKS = 4

function average(values: readonly number[]) {
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100
}

function trend(values: readonly number[]): PreCompetitionLoadTrend {
  if (values.length < 2) return 'stable'

  const delta = values.at(-1)! - values[0]
  if (Math.abs(delta) < 0.01) return 'stable'
  return delta > 0 ? 'rising' : 'falling'
}

function validateWeek(week: PreCompetitionWeekLoad, index: number) {
  if (!Number.isFinite(week.volumeKm) || week.volumeKm < 0) {
    throw new Error(`volumeKm for week ${index + 1} must be finite and non-negative.`)
  }

  if (
    week.elevationGainM !== null
    && (!Number.isFinite(week.elevationGainM) || week.elevationGainM < 0)
  ) {
    throw new Error(`elevationGainM for week ${index + 1} must be null or finite and non-negative.`)
  }
}

/**
 * Derives the reached load context from the most recent complete training weeks.
 *
 * The default four-week reference window is a policy default, not a universal
 * physiological constant. Volume and D+ are assessed independently and no
 * absolute "high load" threshold is introduced here.
 */
export function derivePreCompetitionLoadContext(
  weeks: readonly PreCompetitionWeekLoad[],
  referenceWindowWeeks = DEFAULT_PRE_COMPETITION_REFERENCE_WEEKS,
): PreCompetitionLoadContext {
  if (!Number.isInteger(referenceWindowWeeks) || referenceWindowWeeks < 1) {
    throw new Error('referenceWindowWeeks must be a positive integer.')
  }

  if (weeks.length === 0) {
    throw new Error('At least one pre-competition training week is required.')
  }

  weeks.forEach(validateWeek)

  const recentWeeks = weeks.slice(-referenceWindowWeeks)
  const volumeValues = recentWeeks.map((week) => week.volumeKm)
  const elevationValues = recentWeeks
    .map((week) => week.elevationGainM)
    .filter((value): value is number => value !== null)

  return {
    referenceWindowWeeks,
    analyzedWeeks: recentWeeks.length,
    volume: {
      recentAverageKm: average(volumeValues),
      achievedPeakVolumeKm: Math.max(...volumeValues),
      trend: trend(volumeValues),
    },
    elevation: {
      recentAverageGainM: elevationValues.length > 0 ? average(elevationValues) : null,
      achievedPeakElevationGainM: elevationValues.length > 0 ? Math.max(...elevationValues) : null,
      trend: elevationValues.length > 0 ? trend(elevationValues) : null,
      knownWeeks: elevationValues.length,
    },
  }
}
