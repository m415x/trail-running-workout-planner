import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

const at = '2026-10-14T15:00:00.000Z'
const scope = {
  userId: 'coach', teamId: 'team-a', groupTrainingPlanId: 'plan-a',
  groupId: 'group-a', planningCohortId: null,
}

function fixture(generated: {
  proposal: unknown
  sessionCount: number
  microcycleCount: number
}) {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  for (const table of ['users', 'teams', 'group_training_plans', 'athlete_groups', 'planning_cohorts']) {
    sqlite.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL)`)
  }
  for (const [table, id] of [
    ['users', 'coach'], ['teams', 'team-a'],
    ['group_training_plans', 'plan-a'], ['athlete_groups', 'group-a'],
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
  sqlite.prepare('INSERT INTO microcycles VALUES (?, ?, 0)').run('microcycle-1', 'meso-a')
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  const operations = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => ({ kind: 'authorized' as const, scope }),
    generate: async () => ({
      ...generated, generationExplanations: {}, sourceManifest: { revision: 'v1' },
      schemaVersion: '1', generatorVersion: '1',
    }),
    // Isolated fixture source read: production must re-read real authorized SQL facts.
    readCurrentSourceManifest: async () => ({ revision: 'v1' }),
    now: () => at,
    createId: () => 'review-server',
  })
  return {
    sqlite, operations,
    state: () => sqlite.prepare('SELECT * FROM session_generation_review_snapshots').all(),
  }
}

test('KAN-790 T5.2 CREATE derives event count from proposal, not provided metadata', async () => {
  const f = fixture({
    proposal: { events: [
      { sharedEventKey: 'event-1', session: { title: 'Run' }, prescriptions: [] },
    ] },
    sessionCount: 0, microcycleCount: 0,
  })
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan-a' }),
      /count|proposal|sessions|metadata/i,
    )
    assert.deepEqual(f.state(), [], 'Incorrect server-supplied counters cannot bypass bounds and write evidence')
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 CREATE derives distinct microcycle count from per-event prescriptions', async () => {
  const f = fixture({
    proposal: { events: [
      {
        sharedEventKey: 'event-1', session: { title: 'Run' },
        prescriptions: [{
          generationKey: 'p-1', prescription: { groupId: 'group-a', microcycleId: 'microcycle-1' },
        }],
      },
    ] },
    sessionCount: 1, microcycleCount: 0,
  })
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan-a' }),
      /microcycle|count|metadata/i,
    )
    assert.deepEqual(f.state(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.2 matching server-computed counters permit scoped CREATE', async () => {
  const f = fixture({
    proposal: { events: [{
      sharedEventKey: 'event-1', session: { title: 'Run' },
      prescriptions: [{
        generationKey: 'p-1', prescription: { groupId: 'group-a', microcycleId: 'microcycle-1' },
      }],
    }] },
    sessionCount: 1, microcycleCount: 1,
  })
  try {
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan-a' }), {
      kind: 'created', snapshotId: 'review-server',
    })
    assert.equal(f.state().length, 1)
  } finally { f.sqlite.close() }
})
