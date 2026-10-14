import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  createReviewSnapshotSqlite,
  purgeReviewSnapshotsSqlite,
} from '@/lib/session-generation/review-snapshot-sqlite-repository'

const start = '2026-10-13T12:00:00.000Z'
const cutoff = '2026-10-13T13:00:00.000Z'
const owner = { userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1' }

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

  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))

  // Fixture bypasses allocation quota only after creation, by moving each
  // prior record out of ACTIVE; purge behavior is tested separately.
  for (const [id, status] of [
    ['expired', 'expired'],
    ['invalidated', 'invalidated'],
    ['consumed', 'consumed'],
    ['active', 'active'],
  ] as const) {
    createReviewSnapshotSqlite(db, {
      id, userId: 'u1', teamId: 't1', groupTrainingPlanId: 'p1',
      groupId: 'g1', planningCohortId: null,
      schemaVersion: '1', generatorVersion: '1',
      proposal: { sessions: [{ id }] },
      generationExplanations: { [id]: { stage: 'test' } },
      sourceManifest: { revision: 'r1' },
      sessionCount: 1, microcycleCount: 1,
    }, start)
    if (status === 'consumed') {
      db.prepare(`UPDATE session_generation_review_snapshots
        SET status = 'consumed', consumed_at = ?, result_reference = ?
        WHERE id = ?`).run(start, 'result-1', id)
    } else if (status !== 'active') {
      db.prepare('UPDATE session_generation_review_snapshots SET status = ? WHERE id = ?')
        .run(status, id)
    }
  }
  return db
}

function rows(db: Database.Database) {
  return (db.prepare(`SELECT id, status, consumed_at, result_reference
    FROM session_generation_review_snapshots ORDER BY id`).all() as Array<{
    id: string
    status: string
    consumed_at: string | null
    result_reference: string | null
  }>).map(({ id, status, consumed_at, result_reference }) =>
    ({ id, status, consumed_at, result_reference }))
}

test('KAN-789 purge is explicit, cutoff-bounded and preserves consumed references forever', () => {
  const db = fixture()
  try {
    const removed = purgeReviewSnapshotsSqlite(db, cutoff, owner)
    assert.equal(removed, 2)
    assert.deepEqual(rows(db), [
      { id: 'active', status: 'active', consumed_at: null, result_reference: null },
      { id: 'consumed', status: 'consumed', consumed_at: start, result_reference: 'result-1' },
    ])
    assert.equal(purgeReviewSnapshotsSqlite(db, cutoff, owner), 0, 'Purge rerun must be idempotent')
  } finally {
    db.close()
  }
})

test('KAN-789 purge rejects invalid cutoff without deleting any evidence', () => {
  const db = fixture()
  try {
    const before = rows(db)
    assert.throws(() => purgeReviewSnapshotsSqlite(db, 'not-a-date', owner), /snapshot.*time|canonical/i)
    assert.deepEqual(rows(db), before)
  } finally {
    db.close()
  }
})

test('KAN-789 purge cannot delete entries whose expiry is later than retention cutoff', () => {
  const db = fixture()
  try {
    assert.equal(purgeReviewSnapshotsSqlite(db, start, owner), 0)
    assert.equal(rows(db).length, 4)
  } finally {
    db.close()
  }
})
