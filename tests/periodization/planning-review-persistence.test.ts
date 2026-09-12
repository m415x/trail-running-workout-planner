import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { persistIntegralPlanningReconciliation } from '@/lib/periodization/planning-review-persistence'
import type {
  PlanningReviewAtomicAuditRecord,
  PlanningReviewTransactionPort,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'

interface MemoryState {
  applied: string[]
  audits: PlanningReviewAtomicAuditRecord[]
}

class MemoryTransactionPort implements PlanningReviewTransactionPort<MemoryState> {
  state: MemoryState = { applied: [], audits: [] }

  constructor(private readonly failAuditIdentity: string | null = null) {}

  transaction<TResult>(work: (tx: MemoryState) => TResult): TResult {
    const snapshot = structuredClone(this.state)
    try {
      return work(this.state)
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  applyOperation(tx: MemoryState, operation: PlanningReviewScopedOperation) {
    tx.applied.push(operation.identity)
  }

  appendAuditRecord(tx: MemoryState, record: PlanningReviewAtomicAuditRecord) {
    if (record.identity === this.failAuditIdentity) {
      throw new Error(`audit failure: ${record.identity}`)
    }
    tx.audits.push(record)
  }
}

const scope = {
  teamId: 'team-1',
  groupId: 'group-1',
  groupTrainingPlanId: 'plan-1',
  kind: 'group_base' as const,
  planningCohortId: null,
  sourceGroupTrainingPlanId: null,
}

const provenance = {
  source: 'coach' as const,
  coachId: 'coach-1',
  decidedAt: '2026-09-12T16:20:00.000-03:00',
  reason: 'Bloque aprobado',
}

function operation(
  identity: string,
  entityType: PlanningReviewScopedOperation['entity']['entityType'],
  operationType: PlanningReviewScopedOperation['operation'] = 'create',
): PlanningReviewScopedOperation {
  return {
    identity,
    parentIdentity: null,
    entity: { entityType, entityId: `${entityType}-1` },
    operation: operationType,
    changes: [{ field: '$entity', currentValue: null, proposedValue: {} }],
    blockId: 'block-1',
    decisionProvenance: provenance,
  }
}

function reconciliation(
  operations: readonly PlanningReviewScopedOperation[],
): IntegralPlanningReconciliation {
  const identities = operations.map(({ identity }) => identity)
  return {
    scope,
    blocks: [{
      blockId: 'block-1',
      root: { entityType: 'plan', entityId: 'plan-1' },
      range: null,
      operationIdentities: identities,
      decisionProvenance: provenance,
    }],
    operations,
    planningOperations: operations.filter(({ entity }) => (
      entity.entityType === 'plan'
      || entity.entityType === 'macrocycle'
      || entity.entityType === 'mesocycle'
      || entity.entityType === 'microcycle'
    )),
    sessionOperations: operations.filter(({ entity }) => entity.entityType === 'session'),
    prescriptionOperations: operations.filter(
      ({ entity }) => entity.entityType === 'prescription',
    ),
    competitionOperations: operations.filter(
      ({ entity }) => entity.entityType === 'competition',
    ),
    acceptedItemIdentities: identities,
    rejectedBlockIds: [],
    pendingBlockIds: [],
    coachDecisions: [{
      blockId: 'block-1',
      decision: 'accept',
      provenance,
    }],
  }
}

describe('persistencia atómica de la revisión integral', () => {
  it('aplica operaciones y auditorías dentro de una única transacción', () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('prescription-1', 'prescription'),
      operation('session-1', 'session'),
      operation('microcycle-1', 'microcycle'),
      operation('plan-1', 'plan'),
    ])

    const result = persistIntegralPlanningReconciliation({
      reconciliation: input,
      persistence: port,
    })

    assert.deepEqual(port.state.applied, [
      'plan-1',
      'microcycle-1',
      'session-1',
      'prescription-1',
    ])
    assert.deepEqual(
      port.state.audits.map(({ identity }) => identity),
      port.state.applied,
    )
    assert.deepEqual(result.appliedOperationIdentities, port.state.applied)
    assert.deepEqual(result.auditedOperationIdentities, port.state.applied)
    assert.deepEqual(port.state.audits[0]?.decisionProvenance, provenance)
    assert.deepEqual(port.state.audits[0]?.scope, scope)
  })

  it('ordena eliminaciones desde los hijos hacia sus padres', () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('plan-1', 'plan', 'remove'),
      operation('session-1', 'session', 'remove'),
      operation('microcycle-1', 'microcycle', 'remove'),
      operation('prescription-1', 'prescription', 'remove'),
    ])

    persistIntegralPlanningReconciliation({
      reconciliation: input,
      persistence: port,
    })

    assert.deepEqual(port.state.applied, [
      'prescription-1',
      'session-1',
      'microcycle-1',
      'plan-1',
    ])
  })

  it('revierte todo si falla una auditoría después de aplicar una operación', () => {
    const port = new MemoryTransactionPort('session-1')
    const input = reconciliation([
      operation('plan-1', 'plan'),
      operation('session-1', 'session'),
      operation('prescription-1', 'prescription'),
    ])

    assert.throws(
      () => persistIntegralPlanningReconciliation({
        reconciliation: input,
        persistence: port,
      }),
      /audit failure: session-1/,
    )
    assert.deepEqual(port.state, { applied: [], audits: [] })
  })

  it('rechaza write sets que exceden la selección aceptada antes de abrir la transacción', () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([operation('plan-1', 'plan')])
    const tampered = {
      ...input,
      acceptedItemIdentities: [],
    }

    assert.throws(
      () => persistIntegralPlanningReconciliation({
        reconciliation: tampered,
        persistence: port,
      }),
      /was not accepted by the coach/,
    )
    assert.deepEqual(port.state, { applied: [], audits: [] })
  })
})
