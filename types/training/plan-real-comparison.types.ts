import type {
  RealizedTrainingProvenance,
  RealizedTrainingQuality,
  RealizedMetricUnknownReason,
} from '@/types/training/readiness.types'

/** Session-level outcome. Absence of realized evidence is always `unknown`. */
export type PlanRealComparisonState =
  | 'matched'
  | 'deviation'
  | 'known_not_completed'
  | 'unplanned_realized'
  | 'unknown'

export type PlanRealMetricName =
  | 'distanceKm'
  | 'durationMin'
  | 'elevationGainM'
  | 'intensity'

export type PlanRealMetricUnit =
  | 'km'
  | 'min'
  | 'm'
  | 'bpm'
  | 'rpe'
  | 'hr_zone'
  | 'pam_percent'

export type PlanRealMetricUnknownReason =
  | RealizedMetricUnknownReason
  | 'not_prescribed'
  | 'not_observed'
  | 'no_authoritative_session_link'
  | 'known_not_completed'
  | 'incompatible_units'
  | 'unsupported_intensity_pair'

export type PlanRealMetricOperand =
  | {
      readonly state: 'known'
      readonly value: number | string
      readonly unit: PlanRealMetricUnit
    }
  | {
      readonly state: 'unknown'
      readonly reason: PlanRealMetricUnknownReason
      readonly unit: PlanRealMetricUnit | null
    }

export type PlanRealMetricEvaluation =
  | {
      readonly state: 'matched' | 'deviation'
      readonly planned: Extract<PlanRealMetricOperand, { state: 'known' }>
      readonly realized: Extract<PlanRealMetricOperand, { state: 'known' }>
      /** Realized minus planned, expressed in the shared operand unit. */
      readonly absoluteDelta: number
      /**
       * Percentage relative to the planned operand. Null when the planned
       * baseline is zero or when the metric is categorical.
       */
      readonly relativeDeltaPercent: number | null
    }
  | {
      readonly state: 'not_evaluated'
      readonly planned: PlanRealMetricOperand
      readonly realized: PlanRealMetricOperand
      readonly absoluteDelta: null
      readonly relativeDeltaPercent: null
      readonly reason: PlanRealMetricUnknownReason
    }

export interface PlanRealMetricComparison {
  readonly name: PlanRealMetricName
  readonly evaluation: PlanRealMetricEvaluation
}

export interface PlanRealPlanningContext {
  readonly source: 'cohort' | 'group'
  readonly teamId: string
  readonly groupId: string
  readonly planId: string
  readonly cohortId: string | null
}

export interface PlanRealRealizedContext {
  readonly recordId: string
  readonly provenance: RealizedTrainingProvenance
  readonly quality: RealizedTrainingQuality
  readonly limitations: readonly string[]
}

export interface PlannedSessionComparison {
  readonly kind: 'planned_session'
  readonly state: Exclude<PlanRealComparisonState, 'unplanned_realized'>
  readonly teamId: string
  readonly athleteId: string
  readonly date: string
  readonly sessionId: string
  readonly sessionTitle: string
  readonly planning: PlanRealPlanningContext
  readonly realized: PlanRealRealizedContext | null
  readonly metrics: readonly PlanRealMetricComparison[]
  readonly limitations: readonly string[]
}

export interface UnplannedRealizedComparison {
  readonly kind: 'unplanned_realized'
  readonly state: 'unplanned_realized'
  readonly teamId: string
  readonly athleteId: string
  readonly date: string
  readonly realized: PlanRealRealizedContext
  readonly metrics: readonly PlanRealMetricComparison[]
  readonly limitations: readonly string[]
}

export type PlanRealComparisonItem =
  | PlannedSessionComparison
  | UnplannedRealizedComparison

export type PlanRealPlanningResolutionLimitation =
  | {
      readonly date: string
      readonly status: 'none'
      readonly reason: 'no-group' | 'no-applicable-plan'
      readonly conflictingIds: readonly []
    }
  | {
      readonly date: string
      readonly status: 'conflict'
      readonly reason:
        | 'group-history'
        | 'overlapping-cohorts'
        | 'invalid-cohort-membership'
        | 'multiple-base-plans'
      readonly conflictingIds: readonly string[]
    }

export interface PlanRealComparisonWindow {
  readonly kind: 'week' | 'month'
  readonly startDate: string
  readonly endDate: string
}

export interface AthletePlanRealComparison {
  readonly teamId: string
  readonly athleteId: string
  readonly window: PlanRealComparisonWindow
  readonly items: readonly PlanRealComparisonItem[]
  readonly planningLimitations: readonly PlanRealPlanningResolutionLimitation[]
}
