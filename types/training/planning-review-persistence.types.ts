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
   * Must commit only when work resolves normally and roll back every operation
   * and audit append when work rejects. The async contract is required by
   * PostgreSQL/Supabase transaction clients and remains compatible with in-memory
   * test adapters that resolve immediately.
   */
  transaction<TResult>(work: (tx: TTransaction) => Promise<TResult>): Promise<TResult>
  findCommittedResult(
    tx: TTransaction,
    idempotencyKey: string,
  ): Promise<PersistedIntegralPlanningReconciliation | null>
  applyOperation(
    tx: TTransaction,
    operation: PlanningReviewScopedOperation,
  ): Promise<void>
  appendAuditRecord(
    tx: TTransaction,
    record: PlanningReviewAtomicAuditRecord,
  ): Promise<void>
  markCommitted(
    tx: TTransaction,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ): Promise<void>
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
