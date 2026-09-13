import type { ReadinessCompetitionTarget, ReadinessEvaluationPhaseResolution } from '@/types/training/readiness-competition.types'
import type { ReadinessPolicy } from '@/types/training/readiness-policy.types'
import type { PreparationSummaryUnit, RecentPreparationSummary } from '@/types/training/readiness.types'

export type ReadinessAlertCode =
  | 'continuity_gap'
  | 'competition_distance_exposure_gap'
  | 'competition_elevation_exposure_gap'
  | 'planned_realized_deviation'
  | 'predicted_session_jump'
  | 'long_run_concentration'

export interface ReadinessAlert {
  readonly code: ReadinessAlertCode
  readonly cause: string
  readonly dimension: string
  readonly period: {
    readonly startDate: string
    readonly endDate: string
  }
  readonly evidence: {
    readonly observedValue: number
    readonly referenceValue: number
    readonly unit: PreparationSummaryUnit
  }
  readonly rule: {
    readonly policyVersion: string
    readonly criterion: string
    readonly threshold: number
  }
  readonly limitations: readonly string[]
}

export interface ReadinessAssessmentBase {
  readonly teamId: string
  readonly athleteId: string
  readonly evaluatedAt: string
  readonly target: ReadinessCompetitionTarget
  readonly phase: ReadinessEvaluationPhaseResolution
  readonly summary: RecentPreparationSummary
  readonly policyVersion: string
  readonly policyStatus: ReadinessPolicy['status']
  readonly limitations: readonly string[]
}

export type ReadinessAssessment =
  | (ReadinessAssessmentBase & {
      readonly status: 'insufficient_data'
      readonly alerts: readonly []
    })
  | (ReadinessAssessmentBase & {
      readonly status: 'assessed'
      readonly alerts: readonly ReadinessAlert[]
    })
