import type {
  PlanningReviewAtomicAuditRecord,
  PersistedIntegralPlanningReconciliation,
  PersistIntegralPlanningReconciliationInput,
} from '@/types/training/planning-review-persistence.types'
import type {
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'

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

function orderedOperations(
  operations: readonly PlanningReviewScopedOperation[],
) {
  return [...operations].sort((first, second) => {
    const firstRank = ENTITY_ORDER[first.entity.entityType]
    const secondRank = ENTITY_ORDER[second.entity.entityType]
    const dependencyOrder = first.operation === 'remove'
      && second.operation === 'remove'
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

/**
 * Applies the exact KAN-232 write set and its audit records through one shared
 * transaction. The persistence adapter owns the concrete database mutation but
 * cannot receive or commit any operation outside this transaction callback.
 */
export function persistIntegralPlanningReconciliation<TTransaction>({
  reconciliation,
  persistence,
}: PersistIntegralPlanningReconciliationInput<TTransaction>): PersistedIntegralPlanningReconciliation {
  validateReconciliation(reconciliation)
  const operations = orderedOperations(reconciliation.operations)

  return persistence.transaction((tx) => {
    const appliedOperationIdentities: string[] = []
    const auditedOperationIdentities: string[] = []

    for (const operation of operations) {
      persistence.applyOperation(tx, operation)
      appliedOperationIdentities.push(operation.identity)

      persistence.appendAuditRecord(
        tx,
        auditRecord(reconciliation.scope, operation),
      )
      auditedOperationIdentities.push(operation.identity)
    }

    return {
      scope: reconciliation.scope,
      appliedOperationIdentities,
      auditedOperationIdentities,
      committedBlockIds: reconciliation.blocks.map(({ blockId }) => blockId),
    }
  })
}
