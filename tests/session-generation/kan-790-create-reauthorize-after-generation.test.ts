import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'
import type { AuthorizedReviewSnapshotScope } from '@/lib/session-generation/authorized-review-snapshot-scope'

const at = '2026-10-14T15:00:00.000Z'
const owner: AuthorizedReviewSnapshotScope = {
  userId: 'coach', teamId: 'team-a', groupTrainingPlanId: 'plan-a',
  groupId: 'group-a', planningCohortId: null,
}

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  for (const table of ['users','teams','group_training_plans','athlete_groups','planning_cohorts']) {
    sqlite.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL)`)
  }
  for (const [table,id] of [
    ['users','coach'],['teams','team-a'],['group_training_plans','plan-a'],['athlete_groups','group-a'],
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
  let scope: AuthorizedReviewSnapshotScope = owner
  let authorizeCalls = 0
  let afterGeneration: (() => void) | null = null
  const operations = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => {
      authorizeCalls++
      return allowed ? { kind: 'authorized' as const, scope } : { kind: 'denied' as const }
    },
    generate: async () => {
      afterGeneration?.()
      return {
        proposal: { events: [] }, generationExplanations: {},
        sourceManifest: { revision: 'v1' }, schemaVersion: '1',
        generatorVersion: '1', sessionCount: 0, microcycleCount: 0,
      }
    },
    // Isolated fixture source read: production must re-read real authorized SQL facts.
    readCurrentSourceManifest: async () => ({ revision: 'v1' }),
    now: () => at,
    createId: () => 'server-review',
  })
  const state = () => sqlite.prepare('SELECT * FROM session_generation_review_snapshots ORDER BY id').all()
  return {
    sqlite, operations, state, authorizeCalls: () => authorizeCalls,
    afterGeneration: (fn: () => void) => { afterGeneration = fn },
    revoke: () => { allowed = false },
    switchTeam: () => { scope = { ...owner, teamId: 'team-b' } },
  }
}

test('KAN-790 T5.2 CREATE reauthorizes immediately after asynchronous generation before any SQL write', async () => {
  const f = fixture()
  try {
    f.afterGeneration(() => f.revoke())
    const before = f.state()
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan-a' }), { kind: 'denied' })
    assert.equal(f.authorizeCalls(), 2, 'fresh H2/H3/H4A check must follow generation')
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 CREATE fails closed on Team switch during generation without SQL write', async () => {
  const f = fixture()
  try {
    f.afterGeneration(() => f.switchTeam())
    const before = f.state()
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan-a' }), { kind: 'denied' })
    assert.deepEqual(f.state(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 stable authority permits one CREATE with server-issued opaque locator', async () => {
  const f = fixture()
  try {
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan-a' }), {
      kind: 'created', snapshotId: 'server-review',
    })
    assert.equal(f.authorizeCalls(), 2)
    assert.equal(f.state().length, 1)
  } finally { f.sqlite.close() }
})
