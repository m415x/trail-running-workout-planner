import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptanceSqlitePreflight } from '@/scripts/acceptance-dev-sqlite-preflight'

const projectRoot = resolve(import.meta.dirname, '../..')
const journal = JSON.parse(readFileSync(
  resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8',
)) as { entries: Array<{ tag: string; when: number }> }

function canonicalRows(): Array<{ hash: string; created_at: number }> {
  return journal.entries.map(entry => ({
    hash: createHash('sha256').update(
      readFileSync(resolve(projectRoot, 'drizzle/sqlite', entry.tag + '.sql'), 'utf8'),
    ).digest('hex'),
    created_at: entry.when,
  }))
}

function withMemoryDatabase(run: (sqlite: Database.Database) => void): void {
  const sqlite = new Database(':memory:')
  try {
    run(sqlite)
  } finally {
    sqlite.close()
  }
}

test('KAN-885/T2 preflight rejects missing migration metadata without writing to SQLite', () => {
  withMemoryDatabase(sqlite => {
    sqlite.pragma('query_only = ON')
    assert.throws(
      () => assertAcceptanceSqlitePreflight({ sqlite, projectRoot }),
      /migration|journal|metadata|missing|faltante/i,
    )
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    ).all()
    assert.deepEqual(tables, [])
  })
})

test('KAN-885/T2 preflight rejects incomplete applied migrations without modifying the journal', () => {
  withMemoryDatabase(sqlite => {
    sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)')
    const first = canonicalRows()[0]
    assert.ok(first)
    sqlite.prepare('INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)').run(
      first.hash, first.created_at,
    )
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare('SELECT * FROM __drizzle_migrations').all()
    assert.throws(
      () => assertAcceptanceSqlitePreflight({ sqlite, projectRoot }),
      /migration|journal|incomplete|missing|faltante/i,
    )
    assert.deepEqual(sqlite.prepare('SELECT * FROM __drizzle_migrations').all(), before)
  })
})

test('KAN-885/T2 preflight rejects corrupt HEAD hash without rewriting metadata', () => {
  withMemoryDatabase(sqlite => {
    sqlite.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)')
    const insert = sqlite.prepare(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    )
    const rows = canonicalRows()
    for (const row of rows.slice(0, -1)) insert.run(row.hash, row.created_at)
    const last = rows.at(-1)
    assert.ok(last)
    insert.run('0'.repeat(64), last.created_at)
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare('SELECT * FROM __drizzle_migrations').all()
    assert.throws(
      () => assertAcceptanceSqlitePreflight({ sqlite, projectRoot }),
      /migration|hash|canonical|mismatch|drift/i,
    )
    assert.deepEqual(sqlite.prepare('SELECT * FROM __drizzle_migrations').all(), before)
  })
})
