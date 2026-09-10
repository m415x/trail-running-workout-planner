import { GROUP_VOLUME_MATRIX } from '@/data/periodization-matrix'
import type { LoadStrategyValidationIssue } from '@/lib/periodization/load-strategy-validator'
import type { LoadStrategyDraft } from '@/types'

/** Translates legacy validation codes at the product boundary, without localizing domain rules. */
export function localizeLoadIssue(
  issue: LoadStrategyValidationIssue,
  strategy: LoadStrategyDraft,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const range = GROUP_VOLUME_MATRIX[strategy.context.athleteGroup].range
  if (issue.code.includes('-elevation-density-')) {
    const initial = issue.code.startsWith('initial-')
    const volume = initial ? strategy.values.initialWeeklyVolumeKm : strategy.values.maximumWeeklyVolumeKm
    const elevation = initial ? strategy.values.initialWeeklyElevationGain : strategy.values.maximumWeeklyElevationGain
    return t(issue.code.endsWith('-extreme') ? 'issues.density-extreme' : 'issues.density-high', {
      density: Math.round(((elevation ?? 0) / volume) * 10) / 10,
    })
  }
  return t(`issues.${issue.code}`, { min: range.min, max: range.max, group: strategy.context.athleteGroup })
}
