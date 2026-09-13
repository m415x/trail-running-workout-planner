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

/** Synchronous transaction port retained for SQLite and in-memory adapters. */
export interface PlanningReviewTransactionPort<TTransaction> {
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

/**
 * Async transaction port for PostgreSQL/Supabase adapters. The callback must be
 * committed only when it resolves normally and fully rolled back when it rejects.
 */
export interface AsyncPlanningReviewTransactionPort<TTransaction> {
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

export interface PersistAsyncIntegralPlanningReconciliationInput<TTransaction> {
  readonly reconciliation: IntegralPlanningReconciliation
  readonly persistence: AsyncPlanningReviewTransactionPort<TTransaction>
}

export interface PersistedIntegralPlanningReconciliation {
  readonly idempotencyKey: string
  readonly outcome: 'committed' | 'already_committed'
  readonly scope: PlanningReviewScope
  readonly appliedOperationIdentities: readonly string[]
  readonly auditedOperationIdentities: readonly string[]
  readonly committedBlockIds: readonly string[]
}
