import { integralPlanningIdempotencyKey } from '@/lib/periodization/planning-review-idempotency'
import type {
  PersistAsyncIntegralPlanningReconciliationInput,
  PlanningReviewAtomicAuditRecord,
  PersistedIntegralPlanningReconciliation,
  PersistIntegralPlanningReconciliationInput,
} from '@/types/training/planning-review-persistence.types'
import type {
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'
import type { PlanningReviewScope } from '@/types/training/planning-review.types'

const ENTITY_ORDER: Readonly<Record<
  PlanningReviewScopedOperation['entity']['entityType'],
  number
>> = {
  plan: 0,
  macrocycle: 1,
  mesocycle: 2,
  microcycle: 3,
  competition: 1,
  competition_window: 2,
  session: 4,
  prescription: 5,
}

function sameScope(first: PlanningReviewScope, second: PlanningReviewScope) {
  return first.teamId === second.teamId
    && first.groupId === second.groupId
    && first.groupTrainingPlanId === second.groupTrainingPlanId
    && first.kind === second.kind
    && first.planningCohortId === second.planningCohortId
    && first.sourceGroupTrainingPlanId === second.sourceGroupTrainingPlanId
}

function orderedOperations(
  operations: readonly PlanningReviewScopedOperation[],
) {
  return [...operations].sort((first, second) => {
    const firstRank = ENTITY_ORDER[first.entity.entityType]
    const secondRank = ENTITY_ORDER[second.entity.entityType]
    const firstRemoves = first.operation === 'remove'
    const secondRemoves = second.operation === 'remove'
    if (firstRemoves !== secondRemoves) return firstRemoves ? -1 : 1
    const dependencyOrder = firstRemoves
      ? secondRank - firstRank
      : firstRank - secondRank
    return dependencyOrder || first.identity.localeCompare(second.identity)
  })
}

function validateReconciliation(
  reconciliation: PersistIntegralPlanningReconciliationInput<unknown>['reconciliation'],
) {
  const operationIdentities = reconciliation.operations.map(({ identity }) => identity)
  if (new Set(operationIdentities).size !== operationIdentities.length) {
    throw new Error('Atomic planning write set contains duplicate identities')
  }

  const acceptedIdentities = new Set(reconciliation.acceptedItemIdentities)
  for (const operation of reconciliation.operations) {
    if (!sameScope(operation.scope, reconciliation.scope)) {
      throw new Error(`Operation ${operation.identity} crosses the accepted planning scope`)
    }
    if (!acceptedIdentities.has(operation.identity)) {
      throw new Error(`Operation ${operation.identity} was not accepted by the coach`)
    }
    if (operation.decisionProvenance.source !== 'coach') {
      throw new Error(`Operation ${operation.identity} has invalid decision provenance`)
    }
  }

  if (
    acceptedIdentities.size !== operationIdentities.length
    || operationIdentities.some((identity) => !acceptedIdentities.has(identity))
  ) {
    throw new Error('Accepted identities and atomic operations must match exactly')
  }

  const blockIds = reconciliation.blocks.map(({ blockId }) => blockId)
  if (new Set(blockIds).size !== blockIds.length) {
    throw new Error('Atomic planning write set contains duplicate blocks')
  }
  const committedBlockIds = new Set(blockIds)
  const excludedBlockIds = new Set([
    ...reconciliation.rejectedBlockIds,
    ...reconciliation.pendingBlockIds,
  ])
  for (const operation of reconciliation.operations) {
    if (!committedBlockIds.has(operation.blockId)) {
      throw new Error(`Operation ${operation.identity} belongs to an uncommitted block`)
    }
    if (excludedBlockIds.has(operation.blockId)) {
      throw new Error(`Operation ${operation.identity} belongs to an excluded block`)
    }
  }

  const declaredByBlock = new Map(
    reconciliation.blocks.map((block) => [
      block.blockId,
      new Set(block.operationIdentities),
    ]),
  )
  const declaredIdentities = reconciliation.blocks.flatMap(
    ({ operationIdentities }) => operationIdentities,
  )
  if (
    new Set(declaredIdentities).size !== declaredIdentities.length
    || declaredIdentities.length !== operationIdentities.length
    || declaredIdentities.some((identity) => !acceptedIdentities.has(identity))
  ) {
    throw new Error('Accepted blocks and atomic operations must match exactly')
  }
  for (const operation of reconciliation.operations) {
    if (!declaredByBlock.get(operation.blockId)?.has(operation.identity)) {
      throw new Error(`Operation ${operation.identity} is outside its accepted block`)
    }
  }
}

function auditRecord(
  scope: PersistIntegralPlanningReconciliationInput<unknown>['reconciliation']['scope'],
  operation: PlanningReviewScopedOperation,
): PlanningReviewAtomicAuditRecord {
  return {
    scope,
    identity: operation.identity,
    entity: operation.entity,
    operation: operation.operation,
    blockId: operation.blockId,
    changes: operation.changes,
    decisionProvenance: operation.decisionProvenance,
  }
}

function committedResult(
  reconciliation: PersistIntegralPlanningReconciliationInput<unknown>['reconciliation'],
  idempotencyKey: string,
  appliedOperationIdentities: readonly string[],
  auditedOperationIdentities: readonly string[],
): PersistedIntegralPlanningReconciliation {
  return {
    idempotencyKey,
    outcome: 'committed',
    scope: reconciliation.scope,
    appliedOperationIdentities,
    auditedOperationIdentities,
    committedBlockIds: reconciliation.blocks.map(({ blockId }) => blockId),
  }
}

/** Applies the exact KAN-232 write set through a synchronous transaction port. */
export function persistIntegralPlanningReconciliation<TTransaction>({
  reconciliation,
  persistence,
}: PersistIntegralPlanningReconciliationInput<TTransaction>): PersistedIntegralPlanningReconciliation {
  validateReconciliation(reconciliation)
  const operations = orderedOperations(reconciliation.operations)
  const idempotencyKey = integralPlanningIdempotencyKey(reconciliation)

  return persistence.transaction((tx) => {
    const previous = persistence.findCommittedResult(tx, idempotencyKey)
    if (previous !== null) return { ...previous, outcome: 'already_committed' }

    const appliedOperationIdentities: string[] = []
    const auditedOperationIdentities: string[] = []

    for (const operation of operations) {
      persistence.applyOperation(tx, operation)
      appliedOperationIdentities.push(operation.identity)
      persistence.appendAuditRecord(tx, auditRecord(reconciliation.scope, operation))
      auditedOperationIdentities.push(operation.identity)
    }

    const result = committedResult(
      reconciliation,
      idempotencyKey,
      appliedOperationIdentities,
      auditedOperationIdentities,
    )
    persistence.markCommitted(tx, idempotencyKey, result)
    return result
  })
}

/**
 * Applies the same validated atomic write set through an asynchronous transaction
 * port suitable for PostgreSQL/Supabase clients.
 */
export async function persistIntegralPlanningReconciliationAsync<TTransaction>({
  reconciliation,
  persistence,
}: PersistAsyncIntegralPlanningReconciliationInput<TTransaction>): Promise<PersistedIntegralPlanningReconciliation> {
  validateReconciliation(reconciliation)
  const operations = orderedOperations(reconciliation.operations)
  const idempotencyKey = integralPlanningIdempotencyKey(reconciliation)

  return persistence.transaction(async (tx) => {
    const previous = await persistence.findCommittedResult(tx, idempotencyKey)
    if (previous !== null) return { ...previous, outcome: 'already_committed' }

    const appliedOperationIdentities: string[] = []
    const auditedOperationIdentities: string[] = []

    for (const operation of operations) {
      await persistence.applyOperation(tx, operation)
      appliedOperationIdentities.push(operation.identity)
      await persistence.appendAuditRecord(tx, auditRecord(reconciliation.scope, operation))
      auditedOperationIdentities.push(operation.identity)
    }

    const result = committedResult(
      reconciliation,
      idempotencyKey,
      appliedOperationIdentities,
      auditedOperationIdentities,
    )
    await persistence.markCommitted(tx, idempotencyKey, result)
    return result
  })
}
