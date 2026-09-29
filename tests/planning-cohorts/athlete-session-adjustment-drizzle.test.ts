import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createDrizzleAthleteSessionAdjustmentDatabase,
} from '@/lib/planning-cohorts/athlete-session-adjustment-drizzle-database'
import type {
  PersistedAthleteSessionAdjustment,
  PersistedAthleteSessionAdjustmentRevision,
} from '@/lib/planning-cohorts/athlete-session-adjustment-persistence'

const adjustment: PersistedAthleteSessionAdjustment = {
  id: 'adjustment-1',
  teamId: 'team-1',
  athleteId: 'athlete-1',
  sourcePrescriptionId: 'prescription-1',
}

const previous: PersistedAthleteSessionAdjustmentRevision = {
  id: 'revision-1',
  adjustmentId: 'adjustment-1',
  state: 'active',
  payload: {
    dose: null,
    assignment: { kind: 'inherit' },
  },
  reason: 'Initial',
  changedByUserId: 'coach-1',
  isCurrent: true,
}

const replacement: PersistedAthleteSessionAdjustmentRevision = {
  ...previous,
  id: 'revision-2',
  reason: 'Updated',
}

test('Drizzle inserts adjustment and initial revision atomically', async () => {
  const operations: Array<{ kind: string; values?: Record<string, unknown> }> = []
  let transactions = 0

  const tx = {
    insert: () => ({
      values: (values: Record<string, unknown>[]) => ({
        run: () => operations.push({ kind: 'insert', values: values[0] }),
      }),
    }),
  }

  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    transaction: async (callback: (transaction: typeof tx) => void) => {
      transactions += 1
      callback(tx)
    },
  } as never)

  await db.insertAdjustmentWithRevision(adjustment, previous)

  assert.equal(transactions, 1)
  assert.equal(operations.length, 2)
  assert.equal(operations[0]?.values?.id, 'adjustment-1')
  assert.equal(operations[0]?.values?.athleteId, 'athlete-1')
  assert.equal(operations[0]?.values?.sourcePrescriptionId, 'prescription-1')
  assert.equal(operations[1]?.values?.id, 'revision-1')
  assert.equal(operations[1]?.values?.adjustmentId, 'adjustment-1')
  assert.equal(operations[1]?.values?.isCurrent, true)
})

test('Drizzle replaces current revision atomically and preserves identity', async () => {
  const operations: Array<{ kind: string; values?: Record<string, unknown> }> = []
  let transactions = 0

  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => operations.push({ kind: 'update', values }),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>[]) => ({
        run: () => operations.push({ kind: 'insert', values: values[0] }),
      }),
    }),
  }

  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    transaction: async (callback: (transaction: typeof tx) => void) => {
      transactions += 1
      callback(tx)
    },
  } as never)

  await db.replaceCurrentRevisionAtomically(previous, replacement)

  assert.equal(transactions, 1)
  assert.equal(operations.length, 2)
  assert.deepEqual(operations[0], {
    kind: 'update',
    values: {
      isCurrent: false,
      updatedAt: operations[0]?.values?.updatedAt,
    },
  })
  assert.equal(operations[1]?.values?.id, 'revision-2')
  assert.equal(operations[1]?.values?.adjustmentId, 'adjustment-1')
  assert.equal(operations[1]?.values?.isCurrent, true)
})

test('Drizzle rejects replacement across adjustment identities before writing', async () => {
  let transactions = 0
  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    transaction: async () => {
      transactions += 1
    },
  } as never)

  await assert.rejects(
    () => db.replaceCurrentRevisionAtomically(previous, {
      ...replacement,
      adjustmentId: 'adjustment-other',
    }),
    /identity|adjustment/i,
  )

  assert.equal(transactions, 0)
})

test('Drizzle requires transaction support for append-only lifecycle writes', async () => {
  const db = createDrizzleAthleteSessionAdjustmentDatabase({} as never)

  await assert.rejects(
    () => db.insertAdjustmentWithRevision(adjustment, previous),
    /transaction/i,
  )

  await assert.rejects(
    () => db.replaceCurrentRevisionAtomically(previous, replacement),
    /transaction/i,
  )
})
