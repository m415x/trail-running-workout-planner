import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

const savedManifest = { manifestVersion: 1, groupTrainingPlanId: 'base', generationInputCount: 1, generationInputSha256: 'a'.repeat(64) }

function fixture(currentManifest: unknown) {
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
    INSERT INTO group_training_plans VALUES ('base',0);
    INSERT INTO macrocycles VALUES ('macro','base',0);
    INSERT INTO mesocycles VALUES ('meso','macro',0);
    INSERT INTO microcycles VALUES ('micro','meso',0);
  `)
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql','utf8'))
  let authorizationCount = 0
  let freshnessReadCount = 0
  const ops = createAuthorizedReviewSnapshotOperations({
    sqlite,
    authorize: async () => {
      authorizationCount++
      return { kind: 'authorized' as const, scope: {
        userId: 'coach', teamId: 'team', groupTrainingPlanId: 'base',
        groupId: 'group', planningCohortId: null,
      } }
    },
    generate: async () => ({
      proposal: { events: [{
        sharedEventKey: 'shared',
        session: { title: 'Run' },
        prescriptions: [{ generationKey: 'gen-1',
          prescription: { groupId: 'group', microcycleId: 'micro' } }],
      }] },
      generationExplanations: {}, sourceManifest: savedManifest,
      schemaVersion: '1', generatorVersion: '1', sessionCount: 1, microcycleCount: 1,
    }),
    readCurrentSourceManifest: async () => {
      assert.equal(authorizationCount, 2, 'freshness read occurs after second authorization')
      freshnessReadCount++
      return currentManifest
    },
    now: () => '2026-10-14T15:00:00.000Z',
    createId: () => 'snapshot-1',
  })
  return {
    sqlite, ops,
    count: () => (sqlite.prepare('SELECT count(*) AS n FROM session_generation_review_snapshots').get() as { n: number }).n,
    reads: () => freshnessReadCount,
  }
}

test('KAN-790 T5.3 CREATE rejects stale generation sources after reauthorization without SQL writes', async () => {
  const f = fixture({ ...savedManifest, generationInputSha256: 'b'.repeat(64) })
  try {
    await assert.rejects(() => f.ops.create({ groupTrainingPlanId: 'base' }), /generation_stale/i)
    assert.equal(f.reads(), 1)
    assert.equal(f.count(), 0)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 CREATE fails closed if current server source manifest unavailable', async () => {
  const f = fixture(null)
  try {
    await assert.rejects(() => f.ops.create({ groupTrainingPlanId: 'base' }), /generation_stale/i)
    assert.equal(f.count(), 0)
  } finally { f.sqlite.close() }
})

test('KAN-790 T5.3 CREATE persists only after the current source manifest matches', async () => {
  const f = fixture({ generationInputSha256: savedManifest.generationInputSha256, generationInputCount: 1,
    groupTrainingPlanId: 'base', manifestVersion: 1 })
  try {
    assert.deepEqual(await f.ops.create({ groupTrainingPlanId: 'base' }), { kind: 'created', snapshotId: 'snapshot-1' })
    assert.equal(f.reads(), 1)
    assert.equal(f.count(), 1)
  } finally { f.sqlite.close() }
})
