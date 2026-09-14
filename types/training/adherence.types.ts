import type {
  PlanRealComparisonWindow,
  TrainingComparisonMetricName,
} from '@/types/training/plan-real-comparison.types'

/**
 * Stable identifier for the adherence semantics applied to a result.
 * Increment the version whenever eligibility, denominator, coverage, or
 * interpretation rules change in a way that can alter an athlete result.
 */
export interface AdherenceRuleVersion {
  readonly ruleId: 'plan-adherence'
  readonly version: number
}

export type AdherenceResultState = 'available' | 'insufficient_data'

export type AdherenceInsufficientDataReason =
  | 'no_eligible_planned_sessions'
  | 'insufficient_confirmed_outcomes'
  | 'insufficient_coverage'
  | 'planning_resolution_limited'
  | 'insufficient_comparable_windows'

/**
 * Coverage is deliberately separate from adherence. Unknown sessions remain
 * eligible but unevaluated: they reduce coverage and never count as failure.
 */
export interface AdherenceCoverage {
  /** Planned sessions whose planning context is valid for this athlete/window. */
  readonly eligiblePlannedSessions: number
  /** Eligible sessions with an explicit completed/not-completed outcome. */
  readonly confirmedOutcomeSessions: number
  /** Eligible sessions that remain unknown because evidence is insufficient. */
  readonly unknownSessions: number
  /** Realized free sessions kept outside plan adherence. */
  readonly unplannedRealizedSessions: number
  /** confirmedOutcomeSessions / eligiblePlannedSessions * 100, or null when no eligible sessions exist. */
  readonly coveragePercent: number | null
}

export interface AdherenceFrequencyCounts {
  /** `matched` + `deviation`: realized evidence confirms the planned session was performed. */
  readonly confirmedCompleted: number
  /** `known_not_completed`: explicit evidence confirms non-completion. */
  readonly confirmedNotCompleted: number
  /** Denominator used for frequency adherence. Equals completed + not completed. */
  readonly denominator: number
}

export type AdherenceFrequencyResult =
  | {
      readonly state: 'available'
      readonly counts: AdherenceFrequencyCounts
      /** confirmedCompleted / denominator * 100. */
      readonly adherencePercent: number
    }
  | {
      readonly state: 'insufficient_data'
      readonly counts: AdherenceFrequencyCounts
      readonly adherencePercent: null
      readonly reasons: readonly AdherenceInsufficientDataReason[]
    }

/**
 * Dimension-level adherence stays independent per metric. KAN-260 must never
 * combine distance, duration, elevation and intensity into one opaque score.
 */
export interface AdherenceDimensionCounts {
  readonly comparableSessions: number
  readonly matchedSessions: number
  readonly deviationSessions: number
  readonly notEvaluatedSessions: number
}

export type AdherenceDimensionResult =
  | {
      readonly metric: TrainingComparisonMetricName
      readonly state: 'available'
      readonly counts: AdherenceDimensionCounts
      /** matchedSessions / comparableSessions * 100. */
      readonly adherencePercent: number
    }
  | {
      readonly metric: TrainingComparisonMetricName
      readonly state: 'insufficient_data'
      readonly counts: AdherenceDimensionCounts
      readonly adherencePercent: null
      readonly reasons: readonly AdherenceInsufficientDataReason[]
    }

export interface AdherenceRuleConfiguration extends AdherenceRuleVersion {
  /** Minimum confirmed planned-session outcomes required to publish frequency adherence. */
  readonly minimumConfirmedOutcomes: number
  /** Minimum coverage percentage required to publish an adherence conclusion. */
  readonly minimumCoveragePercent: number
  /** Minimum comparable samples required to publish one metric dimension. */
  readonly minimumComparableSessionsPerDimension: number
  /** Minimum available weekly windows required to publish a trend direction. */
  readonly minimumComparableWindowsForTrend: number
  /** Change smaller than this number of percentage points is considered stable. */
  readonly trendStableBandPercentagePoints: number
}

/**
 * Explainable, read-only adherence projection derived from KAN-259
 * `AthletePlanRealComparison`. It does not mutate planning or realized evidence.
 */
export interface AthleteAdherence {
  readonly teamId: string
  readonly athleteId: string
  readonly window: PlanRealComparisonWindow
  readonly rule: AdherenceRuleConfiguration
  readonly coverage: AdherenceCoverage
  readonly frequency: AdherenceFrequencyResult
  readonly dimensions: readonly AdherenceDimensionResult[]
  /** Planning-resolution limitations inherited from the comparison input. */
  readonly limitations: readonly string[]
}

export interface AdherenceTrendPoint {
  readonly window: PlanRealComparisonWindow
  readonly adherencePercent: number | null
  readonly coveragePercent: number | null
}

export type AdherenceTrendDirection = 'improving' | 'stable' | 'declining'

export type AthleteAdherenceTrend =
  | {
      readonly state: 'available'
      readonly direction: AdherenceTrendDirection
      readonly changePercentagePoints: number
      readonly points: readonly AdherenceTrendPoint[]
      readonly rule: AdherenceRuleConfiguration
    }
  | {
      readonly state: 'insufficient_data'
      readonly direction: null
      readonly changePercentagePoints: null
      readonly points: readonly AdherenceTrendPoint[]
      readonly rule: AdherenceRuleConfiguration
      readonly reasons: readonly AdherenceInsufficientDataReason[]
    }
