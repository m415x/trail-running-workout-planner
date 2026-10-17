import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  createReviewSnapshotSqlite,
  consumeReviewSnapshotSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

const now = '2026-10-13T12:00:00.000Z'
const scope = { id: 'review-1', userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const [name, id] of [
    ['users', 'u1'], ['teams', 't1'], ['group_training_plans', 'p1'],
    ['athlete_groups', 'g1'], ['planning_cohorts', 'c1'],
  ]) {
    db.exec(`CREATE TABLE ${name} (id text PRIMARY KEY NOT NULL)`)
    db.prepare(`INSERT INTO ${name} (id) VALUES (?)`).run(id)
  }
  db.prepare('INSERT INTO users (id) VALUES (?)').run('u2')
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  db.exec('CREATE TABLE committed_generation (id text PRIMARY KEY, result text NOT NULL)')
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

function snapshot(db: Database.Database) {
  return db.prepare('SELECT status, consumed_at, result_reference FROM session_generation_review_snapshots WHERE id = ?')
    .get(scope.id) as { status: string; consumed_at: string | null; result_reference: string | null }
}

function countWrites(db: Database.Database) {
  return (db.prepare('SELECT count(*) AS total FROM committed_generation').get() as { total: number }).total
}

test('KAN-789 consume atomically persists result and records same result for retry', () => {
  const db = fixture()
  try {
    const persist = () => {
      db.prepare('INSERT INTO committed_generation (id, result) VALUES (?, ?)').run('result-1', 'saved')
      return 'result-1'
    }
    const first = consumeReviewSnapshotSqlite(db, scope, now, persist)
    assert.deepEqual(first, { kind: 'consumed', resultReference: 'result-1' })
    assert.deepEqual(snapshot(db), { status: 'consumed', consumed_at: now, result_reference: 'result-1' })
    const retry = consumeReviewSnapshotSqlite(db, scope, now, () => {
      throw new Error('Never duplicate persistence on idempotent retry')
    })
    assert.deepEqual(retry, { kind: 'already_consumed', resultReference: 'result-1' })
    assert.equal(countWrites(db), 1)
  } finally { db.close() }
})

test('KAN-789 failed persistence rolls back both snapshot consumption and writes', () => {
  const db = fixture()
  try {
    assert.throws(() => consumeReviewSnapshotSqlite(db, scope, now, () => {
      db.prepare('INSERT INTO committed_generation (id, result) VALUES (?, ?)').run('result-1', 'partial')
      throw new Error('Persistence failed')
    }), /Persistence failed/)
    assert.equal(countWrites(db), 0)
    assert.deepEqual(snapshot(db), { status: 'active', consumed_at: null, result_reference: null })
  } finally { db.close() }
})

test('KAN-789 wrong owner and expired snapshot do not invoke durable persistence', () => {
  const db = fixture()
  try {
    let writes = 0
    const persist = () => { writes++; return 'result-1' }
    assert.deepEqual(
      consumeReviewSnapshotSqlite(db, { ...scope, userId: 'u2' }, now, persist),
      { kind: 'unavailable' },
    )
    assert.deepEqual(
      consumeReviewSnapshotSqlite(db, scope, '2026-10-13T12:31:00.000Z', persist),
      { kind: 'unavailable' },
    )
    assert.equal(writes, 0)
    assert.equal(snapshot(db).status, 'active')
  } finally { db.close() }
})
