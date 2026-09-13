import type {
  PlanningReviewBlockDecision,
  PlanningReviewCoachDecisionProvenance,
} from '@/types/training/planning-review-block.types'
import type {
  IntegralPlanningDiffOperation,
  IntegralPlanningFieldChange,
} from '@/types/training/planning-review-diff.types'
import type {
  IntegralPlanningReview,
  PlanningReviewIssueReference,
  PlanningReviewScope,
} from '@/types/training/planning-review.types'

export interface PlanningReviewReconciliationRange {
  readonly startDate: string
  readonly endDate: string
}

export interface PlanningReviewScopedOperation {
  readonly scope: PlanningReviewScope
  readonly identity: string
  readonly parentIdentity: string | null
  readonly entity: PlanningReviewIssueReference
  readonly operation: Exclude<IntegralPlanningDiffOperation, 'none'>
  readonly changes: readonly IntegralPlanningFieldChange[]
  readonly blockId: string
  readonly decisionProvenance: PlanningReviewCoachDecisionProvenance
}

export interface PlanningReviewReconciledBlock {
  readonly blockId: string
  readonly root: PlanningReviewIssueReference
  readonly range: PlanningReviewReconciliationRange | null
  readonly operationIdentities: readonly string[]
  readonly decisionProvenance: PlanningReviewCoachDecisionProvenance
}

export interface IntegralPlanningReconciliation {
  readonly scope: PlanningReviewScope
  /** Optimistic-concurrency token of the current review used for this decision. */
  readonly sourceRevisionKey: string
  /** Revision token expected after the accepted proposal has been applied. */
  readonly resultRevisionKey: string
  readonly blocks: readonly PlanningReviewReconciledBlock[]
  readonly operations: readonly PlanningReviewScopedOperation[]
  readonly planningOperations: readonly PlanningReviewScopedOperation[]
  readonly sessionOperations: readonly PlanningReviewScopedOperation[]
  readonly prescriptionOperations: readonly PlanningReviewScopedOperation[]
  readonly competitionOperations: readonly PlanningReviewScopedOperation[]
  readonly acceptedItemIdentities: readonly string[]
  readonly rejectedBlockIds: readonly string[]
  readonly pendingBlockIds: readonly string[]
  readonly coachDecisions: readonly PlanningReviewBlockDecision[]
}

export interface ReconcileAcceptedPlanningBlocksInput {
  readonly current: IntegralPlanningReview
  readonly proposed: IntegralPlanningReview
  readonly decisions: readonly PlanningReviewBlockDecision[]
}
