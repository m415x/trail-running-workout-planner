import type { RealizedMetricName, RealizedTrainingRecord } from '@/types/training/readiness.types'

export interface PlannedSessionLoad {
  readonly sessionId: string
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGainM: number | null
}

export interface PlannedRealizedSessionPair {
  readonly planned: PlannedSessionLoad
  readonly realized: RealizedTrainingRecord
}

export type ReadinessContinuityIndicator =
  | {
      readonly status: 'insufficient_data'
      readonly observedActiveBucketRatio: number | null
      readonly threshold: number
    }
  | {
      readonly status: 'within_threshold' | 'below_threshold'
      readonly observedActiveBucketRatio: number
      readonly threshold: number
    }

export type PlanRealMetricName = Extract<
  RealizedMetricName,
  'distanceKm' | 'durationMin' | 'elevationGainM'
>

export type PlannedRealizedMetricComparison =
  | {
      readonly status: 'insufficient_data'
      readonly metric: PlanRealMetricName
      readonly comparableSessions: number
      readonly minimumComparableSessions: number
      readonly threshold: number
    }
  | {
      readonly status: 'assessed'
      readonly metric: PlanRealMetricName
      readonly comparableSessions: number
      readonly plannedTotal: number
      readonly realizedTotal: number
      readonly relativeDeviation: number
      readonly absoluteRelativeDeviation: number
      readonly threshold: number
      readonly exceedsThreshold: boolean
    }

export interface PlannedRealizedLoadComparison {
  readonly linkedSessions: number
  readonly distanceKm: PlannedRealizedMetricComparison
  readonly durationMin: PlannedRealizedMetricComparison
  readonly elevationGainM: PlannedRealizedMetricComparison
}

export type ComparableSessionBasis = 'workout_id' | 'session_type' | 'coach_selected'

export interface ComparableRealizedSessionSet {
  readonly basis: ComparableSessionBasis
  readonly records: readonly RealizedTrainingRecord[]
}

export type PredictedSessionJumpMetric =
  | {
      readonly status: 'insufficient_data'
      readonly metric: PlanRealMetricName
      readonly comparableSessions: number
      readonly threshold: number
    }
  | {
      readonly status: 'assessed'
      readonly metric: PlanRealMetricName
      readonly comparableSessions: number
      readonly plannedValue: number
      readonly recentReferenceMax: number
      readonly increaseRatio: number
      readonly threshold: number
      readonly exceedsThreshold: boolean
    }

export interface PredictedSessionJumpAssessment {
  readonly comparisonBasis: ComparableSessionBasis
  readonly distanceKm: PredictedSessionJumpMetric
  readonly durationMin: PredictedSessionJumpMetric
  readonly elevationGainM: PredictedSessionJumpMetric
}

export type LongRunConcentrationMetric =
  | {
      readonly status: 'insufficient_data'
      readonly metric: 'distanceKm' | 'durationMin'
      readonly performedSessions: number
      readonly minimumPerformedSessions: number
      readonly threshold: number
    }
  | {
      readonly status: 'assessed'
      readonly metric: 'distanceKm' | 'durationMin'
      readonly performedSessions: number
      readonly weeklyTotal: number
      readonly longestSessionValue: number
      readonly ratio: number
      readonly threshold: number
      readonly exceedsThreshold: boolean
    }

export interface LongRunConcentrationAssessment {
  readonly distance: LongRunConcentrationMetric
  readonly duration: LongRunConcentrationMetric
}
