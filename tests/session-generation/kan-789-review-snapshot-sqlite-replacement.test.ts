import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  createReviewSnapshotSqlite,
  getActiveReviewSnapshotSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

const start = '2026-10-13T12:00:00.000Z'
const later = '2026-10-13T12:01:00.000Z'
const now = '2026-10-13T12:02:00.000Z'
const scope = (id: string) => ({ id, userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' })
const input = (id: string, replaceSnapshotId?: string) => ({
  ...scope(id), groupId: 'g1', planningCohortId: null,
  schemaVersion: '1', generatorVersion: '1',
  proposal: { sessions: [{ id: 's1' }] },
  generationExplanations: { s1: { stage: 'test' } },
  sourceManifest: { revision: 'r1' },
  sessionCount: 1, microcycleCount: 1,
  replaceSnapshotId,
})

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const [table, id] of [
    ['users', 'u1'], ['teams', 't1'], ['group_training_plans', 'p1'],
    ['athlete_groups', 'g1'], ['planning_cohorts', 'c1'],
  ]) {
    db.exec(`CREATE TABLE ${table} (id text PRIMARY KEY NOT NULL)`)
    db.prepare(`INSERT INTO ${table} (id) VALUES (?)`).run(id)
  }
  db.prepare('INSERT INTO users(id) VALUES (?)').run('u2')
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  createReviewSnapshotSqlite(db, input('first'), start)
  createReviewSnapshotSqlite(db, input('second'), later)
  return db
}

function statuses(db: Database.Database) {
  return db.prepare('SELECT id, status FROM session_generation_review_snapshots ORDER BY id').all()
}

test('KAN-789 explicitly replacing oldest active snapshot is atomic, never implicit', () => {
  const db = fixture()
  try {
    assert.throws(() => createReviewSnapshotSqlite(db, input('third'), now), /snapshot.*quota/i)
    assert.equal(statuses(db).length, 2)
    const created = createReviewSnapshotSqlite(db, input('third', 'first'), now)
    assert.equal(created.status, 'active')
    assert.equal(getActiveReviewSnapshotSqlite(db, scope('first'), now), null)
    assert.equal(getActiveReviewSnapshotSqlite(db, scope('second'), now)?.id, 'second')
    assert.deepEqual(statuses(db), [
      { id: 'first', status: 'invalidated' },
      { id: 'second', status: 'active' },
      { id: 'third', status: 'active' },
    ])
  } finally { db.close() }
})

test('KAN-789 rejects cross-owner or non-oldest replacement without mutating existing reviews', () => {
  const db = fixture()
  try {
    for (const candidate of ['second', 'nonexistent']) {
      assert.throws(() => createReviewSnapshotSqlite(db, input('third', candidate), now),
        /snapshot.*(replace|oldest|quota)/i)
    }
    assert.deepEqual(statuses(db), [
      { id: 'first', status: 'active' },
      { id: 'second', status: 'active' },
    ])
    assert.throws(() => createReviewSnapshotSqlite(db, {
      ...input('third', 'first'), userId: 'u2',
    }, now), /snapshot.*(replace|owner|scope)/i)
    assert.equal(statuses(db).length, 2)
  } finally { db.close() }
})
