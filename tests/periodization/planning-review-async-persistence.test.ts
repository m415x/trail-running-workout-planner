import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  persistIntegralPlanningReconciliationAsync,
  StalePlanningReviewError,
} from '@/lib/periodization/planning-review-persistence'
import type {
  AsyncPlanningReviewTransactionPort,
  PlanningReviewAtomicAuditRecord,
  PersistedIntegralPlanningReconciliation,
} from '@/types/training/planning-review-persistence.types'
import type {
  IntegralPlanningReconciliation,
  PlanningReviewScopedOperation,
} from '@/types/training/planning-review-reconciliation.types'
import type { PlanningReviewScope } from '@/types/training/planning-review.types'

interface State {
  applied: string[]
  audits: PlanningReviewAtomicAuditRecord[]
  journal: Record<string, PersistedIntegralPlanningReconciliation>
  revision: string
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
  decidedAt: '2026-09-12T22:00:00.000-03:00',
  reason: 'Async integration boundary',
}

function operation(identity: string, proposedValue = 42): PlanningReviewScopedOperation {
  return {
    scope,
    identity,
    parentIdentity: null,
    entity: { entityType: 'microcycle', entityId: identity },
    operation: 'update',
    changes: [{ field: 'targetVolumeKm', currentValue: 40, proposedValue }],
    blockId: 'block-1',
    decisionProvenance: provenance,
  }
}

function reconciliation(
  sourceRevisionKey = 'revision-a',
  resultRevisionKey = 'revision-b',
  proposedValue = 42,
): IntegralPlanningReconciliation {
  const operations = [operation('microcycle-1', proposedValue)]
  return {
    scope,
    sourceRevisionKey,
    resultRevisionKey,
    blocks: [{
      blockId: 'block-1',
      root: { entityType: 'microcycle', entityId: 'microcycle-1' },
      range: { startDate: '2026-09-07', endDate: '2026-09-13' },
      operationIdentities: ['microcycle-1'],
      decisionProvenance: provenance,
    }],
    operations,
    planningOperations: operations,
    sessionOperations: [],
    prescriptionOperations: [],
    competitionOperations: [],
    acceptedItemIdentities: ['microcycle-1'],
    rejectedBlockIds: [],
    pendingBlockIds: [],
    coachDecisions: [{ blockId: 'block-1', decision: 'accept', provenance }],
  }
}

class AsyncMemoryPort implements AsyncPlanningReviewTransactionPort<State> {
  state: State = { applied: [], audits: [], journal: {}, revision: 'revision-a' }

  constructor(private readonly failAudit = false) {}

  async transaction<TResult>(work: (tx: State) => Promise<TResult>) {
    const snapshot = structuredClone(this.state)
    try {
      return await work(this.state)
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  async findCommittedResult(tx: State, idempotencyKey: string) {
    return tx.journal[idempotencyKey] ?? null
  }

  async lockSourceRevision(_tx: State, _scope: PlanningReviewScope) {
    return this.state.revision
  }

  async applyOperation(tx: State, current: PlanningReviewScopedOperation) {
    await Promise.resolve()
    tx.applied.push(current.identity)
  }

  async appendAuditRecord(tx: State, record: PlanningReviewAtomicAuditRecord) {
    await Promise.resolve()
    if (this.failAudit) throw new Error('async audit failure')
    tx.audits.push(record)
  }

  async markCommitted(
    tx: State,
    idempotencyKey: string,
    result: PersistedIntegralPlanningReconciliation,
  ) {
    tx.journal[idempotencyKey] = result
  }

  async advanceSourceRevision(
    tx: State,
    _scope: PlanningReviewScope,
    sourceRevisionKey: string,
    resultRevisionKey: string,
  ) {
    if (tx.revision !== sourceRevisionKey) {
      throw new Error('revision changed before advance')
    }
    tx.revision = resultRevisionKey
  }
}

describe('persistencia integral asíncrona', () => {
  it('hace commit, avanza la revisión y suprime un replay equivalente', async () => {
    const port = new AsyncMemoryPort()
    const input = reconciliation()

    const first = await persistIntegralPlanningReconciliationAsync({
      reconciliation: input,
      persistence: port,
    })
    const replay = await persistIntegralPlanningReconciliationAsync({
      reconciliation: structuredClone(input),
      persistence: port,
    })

    assert.equal(first.outcome, 'committed')
    assert.equal(replay.outcome, 'already_committed')
    assert.equal(port.state.revision, 'revision-b')
    assert.equal(port.state.applied.length, 1)
    assert.equal(port.state.audits.length, 1)
    assert.equal(Object.keys(port.state.journal).length, 1)
  })

  it('rechaza una entrega distinta basada en una revisión stale sin escribir', async () => {
    const port = new AsyncMemoryPort()
    await persistIntegralPlanningReconciliationAsync({
      reconciliation: reconciliation('revision-a', 'revision-b', 42),
      persistence: port,
    })
    const stateAfterFirst = structuredClone(port.state)

    await assert.rejects(
      persistIntegralPlanningReconciliationAsync({
        reconciliation: reconciliation('revision-a', 'revision-c', 44),
        persistence: port,
      }),
      (error) => (
        error instanceof StalePlanningReviewError
        && error.expectedRevisionKey === 'revision-a'
        && error.actualRevisionKey === 'revision-b'
      ),
    )

    assert.deepEqual(port.state, stateAfterFirst)
  })

  it('revierte writes, journal y revisión cuando falla la auditoría', async () => {
    const port = new AsyncMemoryPort(true)

    await assert.rejects(
      persistIntegralPlanningReconciliationAsync({
        reconciliation: reconciliation(),
        persistence: port,
      }),
      /async audit failure/,
    )

    assert.deepEqual(port.state, {
      applied: [],
      audits: [],
      journal: {},
      revision: 'revision-a',
    })
  })
})
