import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createAuthorizedReviewSnapshotOperations } from '@/lib/session-generation/authorized-review-snapshot-operations'

test('KAN-790 T5.3 CREATE fails closed when no server freshness reader is configured', async () => {
  const sqlite = new Database(':memory:')
  try {
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

    const operations = createAuthorizedReviewSnapshotOperations({
      sqlite,
      authorize: async () => ({ kind: 'authorized' as const, scope: {
        userId: 'coach', teamId: 'team', groupTrainingPlanId: 'base',
        groupId: 'group', planningCohortId: null,
      } }),
      generate: async () => ({
        proposal: { events: [{
          sharedEventKey: 'shared',
          session: { title: 'Run' },
          prescriptions: [{ generationKey: 'gen-1',
            prescription: { groupId: 'group', microcycleId: 'micro' } }],
        }] },
        generationExplanations: {},
        sourceManifest: { manifestVersion: 1, groupTrainingPlanId: 'base',
          generationInputCount: 1, generationInputSha256: 'a'.repeat(64) },
        schemaVersion: '1', generatorVersion: '1',
        sessionCount: 1, microcycleCount: 1,
      }),
      // Intentionally missing readCurrentSourceManifest: this must never be a bypass.
      now: () => '2026-10-14T15:00:00.000Z',
      createId: () => 'snapshot-1',
    })
    await assert.rejects(
      () => operations.create({ groupTrainingPlanId: 'base' }),
      /generation_stale|freshness|source.*reader|source.*unavailable/i,
    )
    const row = sqlite.prepare('SELECT count(*) AS total FROM session_generation_review_snapshots').get() as { total: number }
    assert.equal(row.total, 0)
  } finally {
    sqlite.close()
  }
})
