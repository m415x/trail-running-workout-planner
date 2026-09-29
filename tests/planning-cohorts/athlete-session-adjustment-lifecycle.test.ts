import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAthleteSessionAdjustmentPersistenceAdapter,
  type PersistedAthleteSessionAdjustment,
  type PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

const firstRevision: PersistedAthleteSessionAdjustmentRevision = {
  id: 'revision-1',
  adjustmentId: 'adjustment-1',
  state: 'active',
  payload: {
    dose: {
      distanceKm: { kind: 'override', value: 9 },
      durationMin: { kind: 'inherit' },
      elevationGain: { kind: 'inherit' },
      intensity: { kind: 'inherit' },
      notes: { kind: 'inherit' },
    },
    assignment: { kind: 'inherit' },
  },
  reason: 'Reduced volume after Coach review',
  changedByUserId: 'coach-1',
  isCurrent: true,
}

function createPort() {
  const adjustments: PersistedAthleteSessionAdjustment[] = []
  const revisions: PersistedAthleteSessionAdjustmentRevision[] = []

  return {
    adjustments,
    revisions,
    athleteBelongsToTeam: async (teamId: string, athleteId: string) =>
      teamId === 'team-1' && athleteId === 'athlete-1',
    prescriptionBelongsToTeam: async (teamId: string, prescriptionId: string) =>
      teamId === 'team-1' && prescriptionId === 'prescription-1',
    getAdjustmentByIdentity: async (athleteId: string, sourcePrescriptionId: string) =>
      adjustments.find(item =>
        item.athleteId === athleteId
        && item.sourcePrescriptionId === sourcePrescriptionId
      ) ?? null,
    listAdjustmentRevisions: async (adjustmentId: string) =>
      revisions.filter(item => item.adjustmentId === adjustmentId),
    insertAdjustmentWithRevision: async (
      nextAdjustment: PersistedAthleteSessionAdjustment,
      revision: PersistedAthleteSessionAdjustmentRevision,
    ) => {
      adjustments.push(nextAdjustment)
      revisions.push(revision)
    },
    replaceCurrentRevisionAtomically: async (
      previous: PersistedAthleteSessionAdjustmentRevision,
      replacement: PersistedAthleteSessionAdjustmentRevision,
    ) => {
      const index = revisions.findIndex(item => item.id === previous.id)
      revisions[index] = { ...previous, isCurrent: false }
      revisions.push(replacement)
    },
  }
}

test('creates one logical adjustment anchored to athlete + exact source prescription', async () => {
  const port = createPort()
  const adapter = createAthleteSessionAdjustmentPersistenceAdapter(port)

  const created = await adapter.applyRevision({
    adjustment,
    revision: firstRevision,
  })

  assert.equal(port.adjustments.length, 1)
  assert.equal(port.revisions.length, 1)
  assert.deepEqual(created.adjustment, adjustment)
  assert.deepEqual(created.currentRevision, firstRevision)
})

test('editing appends a new current revision and preserves prior history', async () => {
  const port = createPort()
  port.adjustments.push(adjustment)
  port.revisions.push(firstRevision)
  const adapter = createAthleteSessionAdjustmentPersistenceAdapter(port)

  const replacement: PersistedAthleteSessionAdjustmentRevision = {
    ...firstRevision,
    id: 'revision-2',
    payload: {
      ...firstRevision.payload,
      dose: {
        ...firstRevision.payload.dose!,
        distanceKm: { kind: 'override', value: 8 },
      },
    },
    reason: 'Second Coach review',
  }

  const result = await adapter.applyRevision({
    adjustment,
    revision: replacement,
  })

  assert.equal(port.revisions.length, 2)
  assert.equal(port.revisions[0]?.isCurrent, false)
  assert.equal(port.revisions[1]?.isCurrent, true)
  assert.equal(result.currentRevision.id, 'revision-2')
})

test('withdrawal is an explicit append-only revision and keeps history', async () => {
  const port = createPort()
  port.adjustments.push(adjustment)
  port.revisions.push(firstRevision)
  const adapter = createAthleteSessionAdjustmentPersistenceAdapter(port)

  const withdrawn = await adapter.applyRevision({
    adjustment,
    revision: {
      id: 'revision-2',
      adjustmentId: 'adjustment-1',
      state: 'withdrawn',
      payload: firstRevision.payload,
      reason: 'Return to inherited audience prescription',
      changedByUserId: 'coach-1',
      isCurrent: true,
    },
  })

  assert.equal(port.revisions.length, 2)
  assert.equal(port.revisions[0]?.isCurrent, false)
  assert.equal(withdrawn.currentRevision.state, 'withdrawn')
  assert.equal(withdrawn.currentRevision.isCurrent, true)
})

test('rejects cross-team athlete or prescription scope before writing', async () => {
  const port = createPort()
  const adapter = createAthleteSessionAdjustmentPersistenceAdapter(port)

  await assert.rejects(
    () => adapter.applyRevision({
      adjustment: { ...adjustment, teamId: 'team-other' },
      revision: firstRevision,
    }),
    /team|athlete/i,
  )

  await assert.rejects(
    () => adapter.applyRevision({
      adjustment: { ...adjustment, sourcePrescriptionId: 'prescription-other' },
      revision: firstRevision,
    }),
    /prescription|team/i,
  )

  assert.equal(port.adjustments.length, 0)
  assert.equal(port.revisions.length, 0)
})

test('rejects revision replacement that changes logical adjustment identity', async () => {
  const port = createPort()
  port.adjustments.push(adjustment)
  port.revisions.push(firstRevision)
  const adapter = createAthleteSessionAdjustmentPersistenceAdapter(port)

  await assert.rejects(
    () => adapter.applyRevision({
      adjustment: { ...adjustment, sourcePrescriptionId: 'prescription-other' },
      revision: {
        ...firstRevision,
        id: 'revision-2',
      },
    }),
    /identity|prescription|scope/i,
  )

  assert.equal(port.revisions.length, 1)
  assert.equal(port.revisions[0]?.isCurrent, true)
})
