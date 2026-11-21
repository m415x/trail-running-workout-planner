import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptanceSqliteIntegrity } from '@/scripts/acceptance-dev-integrity'

function withMemoryDatabase(run: (sqlite: Database.Database) => void): void {
  const sqlite = new Database(':memory:')
  try {
    run(sqlite)
  } finally {
    sqlite.close()
  }
}

test('KAN-885/T2 integrity preflight accepts a consistent read-only SQLite connection', () => {
  withMemoryDatabase(sqlite => {
    sqlite.exec('CREATE TABLE parents (id TEXT PRIMARY KEY)')
    sqlite.exec('CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id))')
    sqlite.exec("INSERT INTO parents(id) VALUES ('p1')")
    sqlite.exec("INSERT INTO children(id, parent_id) VALUES ('c1', 'p1')")
    sqlite.pragma('query_only = ON')
    assert.doesNotThrow(() => assertAcceptanceSqliteIntegrity(sqlite))
    assert.equal(sqlite.pragma('query_only', { simple: true }), 1)
  })
})

test('KAN-885/T2 integrity preflight rejects existing foreign-key violations without repair', () => {
  withMemoryDatabase(sqlite => {
    sqlite.pragma('foreign_keys = OFF')
    sqlite.exec('CREATE TABLE parents (id TEXT PRIMARY KEY)')
    sqlite.exec('CREATE TABLE children (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parents(id))')
    sqlite.exec("INSERT INTO children(id, parent_id) VALUES ('orphan', 'not-present')")
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare('SELECT * FROM children').all()
    assert.ok(sqlite.pragma('foreign_key_check').length > 0)
    assert.throws(
      () => assertAcceptanceSqliteIntegrity(sqlite),
      /foreign.key|referential|integrity|integridad|FK/i,
    )
    assert.deepEqual(sqlite.prepare('SELECT * FROM children').all(), before)
  })
})
