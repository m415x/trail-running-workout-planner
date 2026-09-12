import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'
import type {
  PlanningReviewCoachDecisionProvenance,
} from '@/types/training/planning-review-block.types'
import type {
  PlanningReviewIssueReference,
  PlanningReviewScope,
} from '@/types/training/planning-review.types'

export interface PlanningReviewAtomicAuditRecord {
  readonly scope: PlanningReviewScope
  readonly identity: string
  readonly entity: PlanningReviewIssueReference
  readonly operation: PlanningReviewScopedOperation['operation']
  readonly blockId: string
  readonly changes: PlanningReviewScopedOperation['changes']
  readonly decisionProvenance: PlanningReviewCoachDecisionProvenance
}

export interface PlanningReviewTransactionPort<TTransaction> {
  /**
   * Must commit only when work returns normally and roll back every operation
   * and audit append when work throws.
   */
  transaction<TResult>(work: (tx: TTransaction) => TResult): TResult
  findCommittedResult(
    tx: TTransaction,
    idempotencyKey: string,
  ): PersistedIntegralPlanningReconciliation | null
  applyOperation(
    tx: TTransaction,
    operation: PlanningReviewScopedOperation,
  ): void
  appendAuditRecord(
    tx: TTransaction,
    record: PlanningReviewAtomicAuditRecord,
  ): void
  markCommitted(
    tx: TTransaction,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ): void
}

export interface PersistIntegralPlanningReconciliationInput<TTransaction> {
  readonly reconciliation: IntegralPlanningReconciliation
  readonly persistence: PlanningReviewTransactionPort<TTransaction>
}

export interface PersistedIntegralPlanningReconciliation {
  readonly idempotencyKey: string
  readonly outcome: 'committed' | 'already_committed'
  readonly scope: PlanningReviewScope
  readonly appliedOperationIdentities: readonly string[]
  readonly auditedOperationIdentities: readonly string[]
  readonly committedBlockIds: readonly string[]
}
