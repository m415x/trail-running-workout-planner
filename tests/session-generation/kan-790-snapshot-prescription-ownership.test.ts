import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

const now = '2026-10-14T15:00:00.000Z'
const scope = {
  userId: 'coach', teamId: 'team-a', groupTrainingPlanId: 'plan-a',
  groupId: 'group-a', planningCohortId: null,
}
type Prescription = { generationKey: string; prescription: { groupId: string; microcycleId: string } }
type Event = { sharedEventKey: string; session: { title: string }; prescriptions: Prescription[] }

function fixture(events: Event[]) {
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
  sqlite.prepare('INSERT INTO microcycles VALUES (?, ?, 0)').run('micro-1', 'meso-a')
  sqlite.prepare('INSERT INTO microcycles VALUES (?, ?, 0)').run('micro-2', 'meso-a')
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  const operations = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => ({ kind: 'authorized' as const, scope }),
    generate: async () => ({
      proposal: { events },
      generationExplanations: {},
      sourceManifest: { revision: 'v1' },
      schemaVersion: '1',
      generatorVersion: '1',
      sessionCount: events.length,
      microcycleCount: new Set(events.flatMap(e => e.prescriptions.map(p => p.prescription.microcycleId))).size,
    }),
    // Isolated fixture source read: production must re-read real authorized SQL facts.
    readCurrentSourceManifest: async () => ({ revision: 'v1' }),
    now: () => now,
    createId: () => 'server-review',
  })
  return {
    sqlite, operations,
    state: () => sqlite.prepare('SELECT * FROM session_generation_review_snapshots').all(),
  }
}

const prescription = (generationKey: string, groupId = 'group-a', microcycleId = 'micro-1'): Prescription => ({
  generationKey,
  prescription: { groupId, microcycleId },
})

test('KAN-790 T5.3 CREATE rejects a prescription that belongs to another Sporting Group without SQL writes', async () => {
  const f = fixture([{ sharedEventKey: 'shared-1', session: { title: 'Run' },
    prescriptions: [prescription('generation-1', 'group-b')] }])
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan-a' }),
      /group|scope|planning|prescription|ownership/i,
    )
    assert.deepEqual(f.state(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 CREATE rejects duplicate generationKey across distinct events without SQL writes', async () => {
  const f = fixture([
    { sharedEventKey: 'shared-1', session: { title: 'Run A' }, prescriptions: [prescription('duplicate', 'group-a', 'micro-1')] },
    { sharedEventKey: 'shared-2', session: { title: 'Run B' }, prescriptions: [prescription('duplicate', 'group-a', 'micro-2')] },
  ])
  try {
    await assert.rejects(
      () => f.operations.create({ groupTrainingPlanId: 'plan-a' }),
      /generationKey|duplicate|unique|identity/i,
    )
    assert.deepEqual(f.state(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 distinct generated prescription identities in authorized Group permit snapshot creation', async () => {
  const f = fixture([
    { sharedEventKey: 'shared-1', session: { title: 'Run A' }, prescriptions: [prescription('generation-1', 'group-a', 'micro-1')] },
    { sharedEventKey: 'shared-2', session: { title: 'Run B' }, prescriptions: [prescription('generation-2', 'group-a', 'micro-2')] },
  ])
  try {
    assert.deepEqual(await f.operations.create({ groupTrainingPlanId: 'plan-a' }), {
      kind: 'created', snapshotId: 'server-review',
    })
    assert.equal(f.state().length, 1)
  } finally { f.sqlite.close() }
})
