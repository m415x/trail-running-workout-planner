import type {
  IntegralPlanningDiffItem,
} from '@/types/training/planning-review-diff.types'
import type {
  PlanningReviewIssue,
  PlanningReviewIssueReference,
} from '@/types/training/planning-review.types'

export type PlanningReviewDecisionBlockKind =
  | 'plan'
  | 'macrocycle'
  | 'competition'
  | 'unscoped'

export interface PlanningReviewDecisionBlock {
  readonly id: string
  readonly kind: PlanningReviewDecisionBlockKind
  readonly root: PlanningReviewIssueReference
  readonly itemIdentities: readonly string[]
  readonly items: readonly IntegralPlanningDiffItem[]
  readonly dependencyBlockIds: readonly string[]
  readonly issues: readonly PlanningReviewIssue[]
  readonly canAccept: boolean
}

export interface IntegralPlanningDecisionBlocks {
  readonly blocks: readonly PlanningReviewDecisionBlock[]
  readonly issues: readonly PlanningReviewIssue[]
  readonly hasBlockingConflicts: boolean
}

export interface PlanningReviewCoachDecisionProvenance {
  readonly source: 'coach'
  readonly coachId: string
  readonly decidedAt: string
  readonly reason: string | null
}

export interface PlanningReviewBlockDecision {
  readonly blockId: string
  readonly decision: 'accept' | 'reject'
  readonly provenance: PlanningReviewCoachDecisionProvenance
}

export type PlanningReviewBlockDecisionIssueCode =
  | 'duplicate_decision'
  | 'unknown_block'
  | 'conflicted_block_accepted'
  | 'dependency_not_accepted'

export interface PlanningReviewBlockDecisionIssue {
  readonly code: PlanningReviewBlockDecisionIssueCode
  readonly blockId: string
  readonly dependencyBlockId?: string
  readonly message: string
}

export interface IntegralPlanningBlockSelection {
  readonly isValid: boolean
  readonly acceptedBlockIds: readonly string[]
  readonly rejectedBlockIds: readonly string[]
  readonly pendingBlockIds: readonly string[]
  readonly acceptedItemIdentities: readonly string[]
  readonly decisions: readonly PlanningReviewBlockDecision[]
  readonly issues: readonly PlanningReviewBlockDecisionIssue[]
}
