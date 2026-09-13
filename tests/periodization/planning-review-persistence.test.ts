import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { persistIntegralPlanningReconciliation } from '@/lib/periodization/planning-review-persistence'
import type {
  PlanningReviewAtomicAuditRecord,
  PlanningReviewTransactionPort,
  PersistedIntegralPlanningReconciliation,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'

interface MemoryState {
  applied: string[]
  audits: PlanningReviewAtomicAuditRecord[]
  journal: Record<string, PersistedIntegralPlanningReconciliation>
}

class MemoryTransactionPort implements PlanningReviewTransactionPort<MemoryState> {
  state: MemoryState = { applied: [], audits: [], journal: {} }

  constructor(private readonly failAuditIdentity: string | null = null) {}

  async transaction<TResult>(work: (tx: MemoryState) => Promise<TResult>): Promise<TResult> {
    const snapshot = structuredClone(this.state)
    try {
      return await work(this.state)
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  async findCommittedResult(tx: MemoryState, idempotencyKey: string) {
    return tx.journal[idempotencyKey] ?? null
  }

  async applyOperation(tx: MemoryState, operation: PlanningReviewScopedOperation) {
    tx.applied.push(operation.identity)
  }

  async appendAuditRecord(tx: MemoryState, record: PlanningReviewAtomicAuditRecord) {
    if (record.identity === this.failAuditIdentity) {
      throw new Error(`audit failure: ${record.identity}`)
    }
    tx.audits.push(record)
  }

  async markCommitted(
    tx: MemoryState,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ) {
    tx.journal[idempotencyKey] = result
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
    scope,
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
  it('aplica operaciones y auditorías dentro de una única transacción', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('prescription-1', 'prescription'),
      operation('session-1', 'session'),
      operation('microcycle-1', 'microcycle'),
      operation('plan-1', 'plan'),
    ])

    const result = await persistIntegralPlanningReconciliation({
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

  it('ordena eliminaciones desde los hijos hacia sus padres', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('plan-1', 'plan', 'remove'),
      operation('session-1', 'session', 'remove'),
      operation('microcycle-1', 'microcycle', 'remove'),
      operation('prescription-1', 'prescription', 'remove'),
    ])

    await persistIntegralPlanningReconciliation({ reconciliation: input, persistence: port })

    assert.deepEqual(port.state.applied, [
      'prescription-1',
      'session-1',
      'microcycle-1',
      'plan-1',
    ])
  })

  it('revierte todo si falla una auditoría después de aplicar una operación', async () => {
    const port = new MemoryTransactionPort('session-1')
    const input = reconciliation([
      operation('plan-1', 'plan'),
      operation('session-1', 'session'),
      operation('prescription-1', 'prescription'),
    ])

    await assert.rejects(
      persistIntegralPlanningReconciliation({ reconciliation: input, persistence: port }),
      /audit failure: session-1/,
    )
    assert.deepEqual(port.state.applied, [])
    assert.deepEqual(port.state.audits, [])
    assert.deepEqual(port.state.journal, {})
  })

  it('rechaza write sets que exceden la selección aceptada antes de abrir la transacción', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([operation('plan-1', 'plan')])
    const tampered = { ...input, acceptedItemIdentities: [] }

    await assert.rejects(
      persistIntegralPlanningReconciliation({ reconciliation: tampered, persistence: port }),
      /was not accepted by the coach/,
    )
    assert.deepEqual(port.state.applied, [])
    assert.deepEqual(port.state.audits, [])
    assert.deepEqual(port.state.journal, {})
  })

  it('rechaza una operación cuyo team/group/cohort/plan scope fue alterado', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([operation('plan-1', 'plan')])
    const tamperedOperation = {
      ...input.operations[0],
      scope: { ...scope, teamId: 'team-2' },
    }
    const tampered = {
      ...input,
      operations: [tamperedOperation],
      planningOperations: [tamperedOperation],
    }

    await assert.rejects(
      persistIntegralPlanningReconciliation({ reconciliation: tampered, persistence: port }),
      /crosses the accepted planning scope/,
    )
    assert.deepEqual(port.state.applied, [])
    assert.deepEqual(port.state.audits, [])
    assert.deepEqual(port.state.journal, {})
  })

  it('completa eliminaciones antes de altas o actualizaciones', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('plan-new', 'plan', 'create'),
      operation('session-old', 'session', 'remove'),
      operation('prescription-old', 'prescription', 'remove'),
      operation('microcycle-new', 'microcycle', 'update'),
    ])

    await persistIntegralPlanningReconciliation({ reconciliation: input, persistence: port })

    assert.deepEqual(port.state.applied, [
      'prescription-old',
      'session-old',
      'plan-new',
      'microcycle-new',
    ])
  })

  it('no reaplica ni vuelve a auditar una entrega integral equivalente', async () => {
    const port = new MemoryTransactionPort()
    const input = reconciliation([
      operation('plan-1', 'plan'),
      operation('microcycle-1', 'microcycle'),
      operation('competition-1', 'competition'),
      operation('session-1', 'session'),
      operation('prescription-1', 'prescription'),
    ])

    const first = await persistIntegralPlanningReconciliation({
      reconciliation: input,
      persistence: port,
    })
    const stateAfterFirst = structuredClone(port.state)
    const repeated = await persistIntegralPlanningReconciliation({
      reconciliation: structuredClone(input),
      persistence: port,
    })

    assert.equal(first.outcome, 'committed')
    assert.equal(repeated.outcome, 'already_committed')
    assert.equal(repeated.idempotencyKey, first.idempotencyKey)
    assert.deepEqual(port.state, stateAfterFirst)
    assert.equal(port.state.applied.length, 5)
    assert.equal(port.state.audits.length, 5)
    assert.equal(Object.keys(port.state.journal).length, 1)
  })

  it('trata como equivalente el mismo write set aunque cambie el orden de entrada', async () => {
    const port = new MemoryTransactionPort()
    const operations = [
      operation('plan-1', 'plan'),
      operation('microcycle-1', 'microcycle'),
      operation('session-1', 'session'),
    ]
    const firstInput = reconciliation(operations)
    const reorderedInput = reconciliation([...operations].reverse())

    const first = await persistIntegralPlanningReconciliation({
      reconciliation: firstInput,
      persistence: port,
    })
    const repeated = await persistIntegralPlanningReconciliation({
      reconciliation: reorderedInput,
      persistence: port,
    })

    assert.equal(repeated.idempotencyKey, first.idempotencyKey)
    assert.equal(repeated.outcome, 'already_committed')
    assert.equal(port.state.applied.length, 3)
    assert.equal(port.state.audits.length, 3)
  })
})
