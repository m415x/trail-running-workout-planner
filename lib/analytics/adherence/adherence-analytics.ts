import type {
  AdherenceCoverage,
  AdherenceDimensionResult,
  AdherenceFrequencyResult,
  AdherenceRuleVersion,
  AthleteAdherence,
} from '@/types/training/adherence.types'
import type { PlanRealComparisonWindow } from '@/types/training/plan-real-comparison.types'

export interface AdherenceAnalyticsProjection {
  readonly window: PlanRealComparisonWindow
  readonly rule: AdherenceRuleVersion
  readonly coverage: AdherenceCoverage
  readonly frequency: AdherenceFrequencyResult
  readonly dimensions: readonly AdherenceDimensionResult[]
  readonly limitations: readonly string[]
}

/**
 * Read-only projection of KAN-260 semantics. Unknown planned outcomes remain
 * coverage limitations and are never recoded as adherence failures.
 */
export function projectAdherenceAnalytics(
  source: AthleteAdherence,
): AdherenceAnalyticsProjection {
  return {
    window: source.window,
    rule: { ruleId: source.rule.ruleId, version: source.rule.version },
    coverage: source.coverage,
    frequency: source.frequency,
    dimensions: source.dimensions,
    limitations: source.limitations,
  }
}
