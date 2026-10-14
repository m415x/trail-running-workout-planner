import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import Database from 'better-sqlite3'
import {
  createReviewSnapshotSqlite,
  getActiveReviewSnapshotSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  for (const table of ['users', 'teams', 'group_training_plans', 'athlete_groups', 'planning_cohorts']) {
    sqlite.exec(`CREATE TABLE ${table} (id text PRIMARY KEY NOT NULL)`)
    sqlite.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(table === 'users' ? 'u1'
      : table === 'teams' ? 't1'
        : table === 'group_training_plans' ? 'p1'
          : table === 'athlete_groups' ? 'g1' : 'c1')
  }
  sqlite.prepare('INSERT INTO users (id) VALUES (?)').run('u2')
  sqlite.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  return sqlite
}

const input = (id: string, userId = 'u1') => ({
  id, userId, teamId: 't1', groupTrainingPlanId: 'p1', groupId: 'g1',
  planningCohortId: null, schemaVersion: '1', generatorVersion: '1',
  proposal: { sessions: [{ id: 'session-1' }] },
  generationExplanations: { 'session-1': { source: 'test' } },
  sourceManifest: { revision: 'rev-1' },
  sessionCount: 1, microcycleCount: 1,
})

const now = '2026-10-13T12:00:00.000Z'

test('KAN-789 allocates exactly two active snapshots per owner/team/plan and fails closed on third', () => {
  const db = fixture()
  try {
    const a = createReviewSnapshotSqlite(db, input('a'), now)
    const b = createReviewSnapshotSqlite(db, input('b'), now)
    assert.equal(a.status, 'active')
    assert.equal(b.status, 'active')
    assert.equal(a.expiresAt, '2026-10-13T12:30:00.000Z')
    assert.throws(() => createReviewSnapshotSqlite(db, input('c'), now), /snapshot.*(quota|active|limit)/i)
    assert.equal((db.prepare('SELECT COUNT(*) AS count FROM session_generation_review_snapshots').get() as { count: number }).count, 2)
    assert.equal(getActiveReviewSnapshotSqlite(db, { id: 'a', userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }, now)?.id, 'a')
    assert.equal(getActiveReviewSnapshotSqlite(db, { id: 'a', userId: 'u2', teamId: 't1', groupTrainingPlanId: 'p1' }, now), null)
  } finally { db.close() }
})

test('KAN-789 expiry permits new allocation and expired review cannot be retrieved', () => {
  const db = fixture()
  try {
    createReviewSnapshotSqlite(db, input('a'), now)
    createReviewSnapshotSqlite(db, input('b'), now)
    const future = '2026-10-13T12:31:00.000Z'
    assert.equal(getActiveReviewSnapshotSqlite(db, { id: 'a', userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }, future), null)
    const c = createReviewSnapshotSqlite(db, input('c'), future)
    assert.equal(c.id, 'c')
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM session_generation_review_snapshots WHERE status = 'active'").get() as { count: number }).count, 1)
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM session_generation_review_snapshots WHERE status = 'expired'").get() as { count: number }).count, 2)
  } finally { db.close() }
})
