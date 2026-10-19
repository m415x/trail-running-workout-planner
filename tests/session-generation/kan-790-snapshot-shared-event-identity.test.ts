import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

function setup(keys: string[]) {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  for (const table of ['users', 'teams', 'athlete_groups', 'planning_cohorts']) {
    sqlite.exec('CREATE TABLE ' + table + ' (id TEXT PRIMARY KEY NOT NULL)')
  }
  sqlite.exec(`
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
    INSERT INTO group_training_plans VALUES ('plan',0);
    INSERT INTO macrocycles VALUES ('macro','plan',0);
    INSERT INTO mesocycles VALUES ('meso','macro',0);
    INSERT INTO microcycles VALUES ('micro','meso',0);
    INSERT INTO users VALUES ('coach');
    INSERT INTO teams VALUES ('team');
    INSERT INTO athlete_groups VALUES ('group');
  `)
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  const operations = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => ({ kind: 'authorized' as const, scope: {
      userId: 'coach', teamId: 'team', groupTrainingPlanId: 'plan',
      groupId: 'group', planningCohortId: null,
    } }),
    generate: async () => ({
      proposal: { events: keys.map((sharedEventKey, index) => ({
        sharedEventKey,
        session: { title: 'Run' },
        prescriptions: [{ generationKey: 'gen-' + index,
          prescription: { groupId: 'group', microcycleId: 'micro' } }],
      })) },
      generationExplanations: {}, sourceManifest: { revision: 'v1' },
      schemaVersion: '1', generatorVersion: '1', sessionCount: keys.length,
      microcycleCount: keys.length ? 1 : 0,
    }),
    // Isolated fixture source read: production must re-read real authorized SQL facts.
    readCurrentSourceManifest: async () => ({ revision: 'v1' }),
    now: () => '2026-10-14T15:00:00.000Z',
    createId: () => 'review',
  })
  const rows = () => sqlite.prepare('SELECT id FROM session_generation_review_snapshots').all()
  return { sqlite, operations, rows }
}

test('KAN-790 T5.3 rejects duplicate sharedEventKey without writing', async () => {
  const f = setup(['shared-a', 'shared-a'])
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan' }),
      /sharedEventKey|duplicate|event identity/i,
    )
    assert.deepEqual(f.rows(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 rejects blank sharedEventKey without writing', async () => {
  const f = setup([' '])
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan' }),
      /sharedEventKey|event identity/i,
    )
    assert.deepEqual(f.rows(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 accepts distinct sharedEventKeys', async () => {
  const f = setup(['shared-a', 'shared-b'])
  try {
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan' }), {
      kind: 'created', snapshotId: 'review',
    })
    assert.equal(f.rows().length, 1)
  } finally { f.sqlite.close() }
})
