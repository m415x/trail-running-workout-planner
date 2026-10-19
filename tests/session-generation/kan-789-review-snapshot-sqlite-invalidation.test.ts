import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  createReviewSnapshotSqlite,
  getActiveReviewSnapshotSqlite,
  consumeReviewSnapshotSqlite,
  invalidateReviewSnapshotSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

const now = '2026-10-13T12:00:00.000Z'
const scope = { id: 'review-1', userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }

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
  db.prepare('INSERT INTO users (id) VALUES (?)').run('u2')
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  createReviewSnapshotSqlite(db, {
    ...scope, groupId: 'g1', planningCohortId: null,
    schemaVersion: '1', generatorVersion: '1',
    proposal: { sessions: [{ id: 's1' }] },
    generationExplanations: { s1: { stage: 'test' } },
    sourceManifest: { revision: 'r1' },
    sessionCount: 1, microcycleCount: 1,
  }, now)
  return db
}

function state(db: Database.Database) {
  return db.prepare('SELECT status, consumed_at, result_reference FROM session_generation_review_snapshots WHERE id = ?')
    .get(scope.id) as { status: string; consumed_at: string | null; result_reference: string | null }
}

test('KAN-789 owner-scoped invalidation is explicit, repeatable and blocks subsequent consumption', () => {
  const db = fixture()
  try {
    assert.equal(invalidateReviewSnapshotSqlite(db, { ...scope, userId: 'u2' }, now), false)
    assert.equal(state(db).status, 'active')
    assert.equal(invalidateReviewSnapshotSqlite(db, scope, now), true)
    assert.deepEqual(state(db), { status: 'invalidated', consumed_at: null, result_reference: null })
    assert.equal(getActiveReviewSnapshotSqlite(db, scope, now), null)
    assert.equal(invalidateReviewSnapshotSqlite(db, scope, now), false)
    let writes = 0
    assert.deepEqual(consumeReviewSnapshotSqlite(db, scope, now, () => {
      writes++
      return 'result-1'
    }), { kind: 'unavailable' })
    assert.equal(writes, 0)
  } finally { db.close() }
})

test('KAN-789 invalidation cannot erase consumed evidence or idempotent result', () => {
  const db = fixture()
  try {
    assert.deepEqual(
      consumeReviewSnapshotSqlite(db, scope, now, () => 'durable-result-1'),
      { kind: 'consumed', resultReference: 'durable-result-1' },
    )
    assert.equal(invalidateReviewSnapshotSqlite(db, scope, now), false)
    assert.deepEqual(state(db), {
      status: 'consumed', consumed_at: now, result_reference: 'durable-result-1',
    })
    assert.deepEqual(
      consumeReviewSnapshotSqlite(db, scope, now, () => { throw new Error('Duplicate write') }),
      { kind: 'already_consumed', resultReference: 'durable-result-1' },
    )
  } finally { db.close() }
})
