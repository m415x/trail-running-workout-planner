import type {
  PlanningReviewIssue,
  PlanningReviewIssueReference,
} from '@/types/training/planning-review.types'

export type IntegralPlanningDiffClassification =
  | 'added'
  | 'updated'
  | 'preserved'
  | 'conflict'

export type IntegralPlanningDiffOperation =
  | 'create'
  | 'update'
  | 'remove'
  | 'none'

export type IntegralPlanningDiffReason =
  | 'new_entity'
  | 'generated_change'
  | 'unchanged'
  | 'protected_change'
  | 'protected_absence'
  | 'validation_conflict'

export interface IntegralPlanningFieldChange {
  readonly field: string
  readonly currentValue: unknown
  readonly proposedValue: unknown
}

export interface IntegralPlanningDiffItem {
  readonly identity: string
  readonly parentIdentity: string | null
  readonly entity: PlanningReviewIssueReference
  readonly classification: IntegralPlanningDiffClassification
  readonly operation: IntegralPlanningDiffOperation
  readonly reason: IntegralPlanningDiffReason
  readonly changes: readonly IntegralPlanningFieldChange[]
}

export interface IntegralPlanningDiffCounts {
  readonly added: number
  readonly updated: number
  readonly preserved: number
  readonly conflict: number
}

export interface IntegralPlanningDiff {
  readonly items: readonly IntegralPlanningDiffItem[]
  readonly counts: IntegralPlanningDiffCounts
  readonly issues: readonly PlanningReviewIssue[]
  readonly hasConflicts: boolean
}
