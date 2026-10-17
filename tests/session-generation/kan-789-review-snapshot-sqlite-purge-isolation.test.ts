import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  createReviewSnapshotSqlite,
  purgeReviewSnapshotsSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

test('KAN-789 SQLite purge never affects terminal records of another owner scope', () => {
  const db = new Database(':memory:')
  const now = '2026-10-13T12:00:00.000Z'
  const cutoff = '2026-10-13T13:00:00.000Z'
  try {
    db.pragma('foreign_keys = ON')
    for (const [table, ids] of [
      ['users', ['u1', 'u2']], ['teams', ['t1', 't2']],
      ['group_training_plans', ['p1', 'p2']],
      ['athlete_groups', ['g1', 'g2']], ['planning_cohorts', ['c1']],
    ] as const) {
      db.exec(`CREATE TABLE ${table} (id text PRIMARY KEY NOT NULL)`)
      for (const id of ids) db.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(id)
    }
    db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))

    const scope1 = { userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }
    const scope2 = { userId: 'u2', teamId: 't2', groupTrainingPlanId: 'p2' }
    for (const [id, scope, groupId] of [
      ['first', scope1, 'g1'], ['other', scope2, 'g2'],
    ] as const) {
      createReviewSnapshotSqlite(db, {
        id, ...scope, groupId, planningCohortId: null,
        schemaVersion: '1', generatorVersion: '1',
        proposal: { sessions: [{ id }] },
        generationExplanations: { [id]: { stage: 'test' } },
        sourceManifest: { revision: 'r1' },
        sessionCount: 1, microcycleCount: 1,
      }, now)
      db.prepare(`UPDATE session_generation_review_snapshots
        SET status = 'invalidated' WHERE id = ?`).run(id)
    }

    assert.equal(purgeReviewSnapshotsSqlite(db, cutoff, scope1), 1)
    const remaining = db.prepare(`SELECT id, status
      FROM session_generation_review_snapshots ORDER BY id`).all()
    assert.deepEqual(remaining, [{ id: 'other', status: 'invalidated' }])
    assert.equal(purgeReviewSnapshotsSqlite(db, cutoff, scope1), 0)
    assert.equal(purgeReviewSnapshotsSqlite(db, cutoff, scope2), 1)
  } finally {
    db.close()
  }
})
