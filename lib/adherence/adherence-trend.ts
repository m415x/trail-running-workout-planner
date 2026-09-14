import type {
  AdherenceRuleConfiguration,
  AthleteAdherence,
  AthleteAdherenceTrend,
} from '@/types'

import { DEFAULT_ADHERENCE_RULE } from '@/lib/adherence/athlete-adherence'

/**
 * Builds a directional trend only from weekly windows whose frequency result is
 * publishable. Unknown-dominant or planning-limited weeks remain visible as
 * null points and cannot steer the trend.
 */
export function deriveAthleteAdherenceTrend(
  windows: readonly AthleteAdherence[],
  rule: AdherenceRuleConfiguration = DEFAULT_ADHERENCE_RULE,
): AthleteAdherenceTrend {
  const ordered = [...windows].sort((first, second) => (
    first.window.startDate.localeCompare(second.window.startDate)
  ))

  const points = ordered.map(result => ({
    window: result.window,
    adherencePercent: result.frequency.adherencePercent,
    coveragePercent: result.coverage.coveragePercent,
  }))

  const comparable = points.filter(point => point.adherencePercent !== null)
  if (comparable.length < rule.minimumComparableWindowsForTrend) {
    return {
      state: 'insufficient_data',
      direction: null,
      changePercentagePoints: null,
      points,
      rule,
      reasons: ['insufficient_comparable_windows'],
    }
  }

  const first = comparable[0].adherencePercent as number
  const last = comparable[comparable.length - 1].adherencePercent as number
  const changePercentagePoints = last - first
  const direction = Math.abs(changePercentagePoints) < rule.trendStableBandPercentagePoints
    ? 'stable' as const
    : changePercentagePoints > 0
      ? 'improving' as const
      : 'declining' as const

  return {
    state: 'available',
    direction,
    changePercentagePoints,
    points,
    rule,
  }
}
