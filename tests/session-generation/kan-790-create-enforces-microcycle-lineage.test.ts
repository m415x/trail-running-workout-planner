import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

const NOW = '2026-10-14T15:00:00.000Z'
function fixture(planId: 'base' | 'variant', microcycleId: string) {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE teams (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY NOT NULL, team_id TEXT NOT NULL);
    CREATE TABLE planning_cohorts (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY NOT NULL, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY NOT NULL, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY NOT NULL, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    INSERT INTO users VALUES ('coach');
    INSERT INTO teams VALUES ('team');
    INSERT INTO athlete_groups VALUES ('group','team');
    INSERT INTO planning_cohorts VALUES ('cohort');
    INSERT INTO group_training_plans VALUES ('base',0),('variant',0);
    INSERT INTO macrocycles VALUES ('macro-b','base',0),('macro-v','variant',0);
    INSERT INTO mesocycles VALUES ('meso-b','macro-b',0),('meso-v','macro-v',0);
    INSERT INTO microcycles VALUES ('week-b','meso-b',0),('week-v','meso-v',0);
  `)
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql','utf8'))
  const scope = {
    userId: 'coach', teamId: 'team', groupTrainingPlanId: planId,
    groupId: 'group', planningCohortId: planId === 'base' ? null : 'cohort',
  }
  const ops = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => ({ kind: 'authorized' as const, scope }),
    generate: async () => ({
      proposal: { events: [{
        sharedEventKey: 'shared', session: { title: 'Run' },
        prescriptions: [{
          generationKey: 'g-' + microcycleId,
          prescription: { groupId: 'group', microcycleId },
        }],
      }] },
      generationExplanations: {}, sourceManifest: { revision: 'v1' },
      sessionCount: 1, microcycleCount: 1, schemaVersion: '1', generatorVersion: '1',
    }),
    // Isolated fixture source read: production must re-read real authorized SQL facts.
    readCurrentSourceManifest: async () => ({ revision: 'v1' }),
    now: () => NOW,
    createId: () => 'review-' + planId,
  })
  return {
    sqlite, ops,
    rows: () => sqlite.prepare('SELECT id,group_training_plan_id,status FROM session_generation_review_snapshots ORDER BY id').all(),
  }
}

test('KAN-790 T5.3 CREATE rejects a Variant microcycle when scoped to Base, no SQL writes', async () => {
  const f = fixture('base', 'week-v')
  try {
    const before = f.rows()
    await assert.rejects(
      () => f.ops.create({ groupTrainingPlanId: 'base' }),
      /microcycle|lineage|plan/i,
    )
    assert.deepEqual(f.rows(), before)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 CREATE rejects Base microcycle when scoped to Variant, no SQL writes', async () => {
  const f = fixture('variant', 'week-b')
  try {
    await assert.rejects(
      () => f.ops.create({ groupTrainingPlanId: 'variant' }),
      /microcycle|lineage|plan/i,
    )
    assert.deepEqual(f.rows(), [])
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 CREATE accepts persisted microcycle ancestry of each independent Plan', async () => {
  for (const [plan, micro] of [['base','week-b'],['variant','week-v']] as const) {
    const f = fixture(plan,micro)
    try {
      assert.deepEqual(await f.ops.create({ groupTrainingPlanId: plan }), {
        kind: 'created', snapshotId: 'review-' + plan,
      })
      assert.equal(f.rows().length, 1)
    } finally { f.sqlite.close() }
  }
})

test('KAN-790 T5.3 CREATE rejects deleted ancestor before allocating durable snapshot', async () => {
  const f = fixture('base','week-b')
  try {
    f.sqlite.prepare("UPDATE mesocycles SET is_deleted=1 WHERE id='meso-b'").run()
    await assert.rejects(
      () => f.ops.create({ groupTrainingPlanId: 'base' }),
      /microcycle|lineage|plan/i,
    )
    assert.deepEqual(f.rows(), [])
  } finally { f.sqlite.close() }
})
