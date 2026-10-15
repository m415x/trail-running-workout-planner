import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { reconcileAndPersistGeneratedSessionsSqlite } from '@/lib/session-generation/review-snapshot-reconciliation-writer'

test('KAN-790 T5.4 mismatched Drizzle/SQLite handles fail before reconciliation SQL despite active CAS transaction', () => {
  const casSqlite = new Database(':memory:')
  const otherSqlite = new Database(':memory:')
  try {
    casSqlite.exec('CREATE TABLE cas_sentinel (id TEXT PRIMARY KEY)')
    otherSqlite.exec('CREATE TABLE other_sentinel (id TEXT PRIMARY KEY)')
    const wrongDrizzle = drizzle(otherSqlite)
    const cas = casSqlite.transaction(() => {
      casSqlite.prepare('INSERT INTO cas_sentinel (id) VALUES (?)').run('attempt')
      reconcileAndPersistGeneratedSessionsSqlite({
        database: wrongDrizzle,
        sqlite: casSqlite,
        withinExistingTransaction: true,
        planId: 'plan-a',
        teamId: 'team-a',
        userId: 'coach',
        proposal: { events: [], warnings: [] },
        generationExplanations: new Map(),
        authorizedGroupIds: new Set(['group-a']),
        now: '2026-10-14T20:45:00.000Z',
      })
    })
    assert.throws(() => cas.immediate(), /reconciliation_conflict: SQLite transaction connection mismatch/)
    assert.equal((casSqlite.prepare('SELECT count(*) AS n FROM cas_sentinel').get() as { n: number }).n, 0)
    assert.equal((otherSqlite.prepare('SELECT count(*) AS n FROM other_sentinel').get() as { n: number }).n, 0)
  } finally {
    casSqlite.close()
    otherSqlite.close()
  }
})
