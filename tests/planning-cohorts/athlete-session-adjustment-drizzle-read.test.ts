import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createDrizzleAthleteSessionAdjustmentDatabase,
} from '@/lib/planning-cohorts/athlete-session-adjustment-drizzle-database'

test('Drizzle reads one adjustment by exact athlete + source prescription identity', async () => {
  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    select: () => ({
      from: () => ({
        where: async () => [{
          id: 'adjustment-1',
          teamId: 'team-1',
          athleteId: 'athlete-1',
          sourcePrescriptionId: 'prescription-1',
        }],
      }),
    }),
  } as never)

  const result = await db.getAdjustmentByIdentity('athlete-1', 'prescription-1')

  assert.deepEqual(result, {
    id: 'adjustment-1',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sourcePrescriptionId: 'prescription-1',
  })
})

test('Drizzle lists the complete append-only revision stream for one adjustment', async () => {
  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: 'revision-1',
            adjustmentId: 'adjustment-1',
            state: 'active',
            payload: {
              dose: null,
              assignment: { kind: 'inherit' },
            },
            reason: 'Initial',
            changedByUserId: 'coach-1',
            isCurrent: false,
          },
          {
            id: 'revision-2',
            adjustmentId: 'adjustment-1',
            state: 'withdrawn',
            payload: {
              dose: null,
              assignment: { kind: 'inherit' },
            },
            reason: 'Withdrawn',
            changedByUserId: 'coach-1',
            isCurrent: true,
          },
        ],
      }),
    }),
  } as never)

  const revisions = await db.listAdjustmentRevisions('adjustment-1')

  assert.equal(revisions.length, 2)
  assert.equal(revisions[0]?.isCurrent, false)
  assert.equal(revisions[1]?.state, 'withdrawn')
  assert.equal(revisions[1]?.isCurrent, true)
})

test('Drizzle resolves athlete and prescription team scope explicitly', async () => {
  const responses = [
    [{ id: 'athlete-1' }],
    [{ id: 'prescription-1' }],
  ]
  let selectCalls = 0

  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => responses[selectCalls++] ?? [],
        }),
        where: async () => responses[selectCalls++] ?? [],
      }),
    }),
  } as never)

  assert.equal(await db.athleteBelongsToTeam('team-1', 'athlete-1'), true)
  assert.equal(await db.prescriptionBelongsToTeam('team-1', 'prescription-1'), true)
})

test('Drizzle returns false/null when athlete, prescription or logical adjustment is outside scope', async () => {
  const db = createDrizzleAthleteSessionAdjustmentDatabase({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [],
        }),
        where: async () => [],
      }),
    }),
  } as never)

  assert.equal(await db.athleteBelongsToTeam('team-1', 'athlete-other'), false)
  assert.equal(await db.prescriptionBelongsToTeam('team-1', 'prescription-other'), false)
  assert.equal(
    await db.getAdjustmentByIdentity('athlete-other', 'prescription-other'),
    null,
  )
})
