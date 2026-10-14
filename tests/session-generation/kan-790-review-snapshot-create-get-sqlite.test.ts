import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

const now = '2026-10-14T15:00:00.000Z'
const owner = {
  userId: 'coach', teamId: 'team-a',
  groupTrainingPlanId: 'plan-a', groupId: 'group-a', planningCohortId: null,
}

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  for (const table of ['users', 'teams', 'group_training_plans', 'athlete_groups', 'planning_cohorts']) {
    sqlite.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL)`)
  }
  for (const [table, id] of [
    ['users', 'coach'], ['teams', 'team-a'], ['group_training_plans', 'plan-a'],
    ['athlete_groups', 'group-a'],
  ]) sqlite.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(id)
  // Positive CREATE fixtures must use real persisted Plan→macro→meso→micro ancestry.
  sqlite.exec(`
    ALTER TABLE group_training_plans ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY NOT NULL, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY NOT NULL, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY NOT NULL, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0);
  `)

  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))

  let allowed = true
  let generationCalls = 0
  const operations = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => allowed
      ? { kind: 'authorized' as const, scope: owner }
      : { kind: 'denied' as const },
    generate: async () => {
      generationCalls++
      return {
        proposal: { events: [] },
        generationExplanations: {},
        sourceManifest: { generatorVersion: 'v1' },
        schemaVersion: 'v1',
        generatorVersion: 'v1',
        sessionCount: 0,
        microcycleCount: 0,
      }
    },
    now: () => now,
  })
  const snapshotState = () => sqlite.prepare(
    'SELECT id,user_id,team_id,group_training_plan_id,status,created_at,expires_at,consumed_at,result_reference FROM session_generation_review_snapshots ORDER BY id',
  ).all()
  return { sqlite, operations, snapshotState, deny: () => { allowed = false }, generationCalls: () => generationCalls }
}

test('KAN-790 T5.2 explicit authorized CREATE persists one server-generated SQL snapshot', async () => {
  const f = fixture()
  try {
    assert.deepEqual(f.snapshotState(), [])
    const result = await f.operations.create({ groupTrainingPlanId: 'plan-a', snapshotId: 'review-1' })
    assert.deepEqual(result, { kind: 'created', snapshotId: 'review-1' })
    assert.equal(f.generationCalls(), 1)
    assert.equal(f.snapshotState().length, 1)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 GET is read-only: no generation, TTL extension, lifecycle update or consume', async () => {
  const f = fixture()
  try {
    await f.operations.create({ groupTrainingPlanId: 'plan-a', snapshotId: 'review-1' })
    const before = f.snapshotState()
    const calls = f.generationCalls()
    const fetched = await f.operations.get({ groupTrainingPlanId: 'plan-a', snapshotId: 'review-1' })
    assert.equal(fetched.kind, 'available')
    assert.equal(f.generationCalls(), calls)
    assert.deepEqual(f.snapshotState(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 revoked authority DENY produces no generator work and no durable writes', async () => {
  const f = fixture()
  try {
    f.deny()
    const before = f.snapshotState()
    assert.deepEqual(
      await f.operations.create({ groupTrainingPlanId: 'plan-a', snapshotId: 'blocked' }),
      { kind: 'denied' },
    )
    assert.deepEqual(
      await f.operations.get({ groupTrainingPlanId: 'plan-a', snapshotId: 'missing' }),
      { kind: 'denied' },
    )
    assert.equal(f.generationCalls(), 0)
    assert.deepEqual(f.snapshotState(), before)
  } finally { f.sqlite.close() }
})
