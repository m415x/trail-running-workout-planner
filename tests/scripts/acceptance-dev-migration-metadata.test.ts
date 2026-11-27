import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptanceMigrationMetadata } from '@/scripts/acceptance-dev-migration-metadata'

const projectRoot = resolve(import.meta.dirname, '../..')

type Entry = { idx: number; tag: string; when: number }

function canonicalRows(): Array<{ hash: string; created_at: number }> {
  const journal = JSON.parse(
    readFileSync(resolve(projectRoot, 'drizzle/sqlite/meta/_journal.json'), 'utf8'),
  ) as { entries: Entry[] }
  return journal.entries.map(entry => ({
    hash: createHash('sha256')
      .update(readFileSync(resolve(projectRoot, 'drizzle/sqlite', entry.tag + '.sql'), 'utf8'))
      .digest('hex'),
    created_at: entry.when,
  }))
}

function withDatabase(run: (sqlite: Database.Database) => void): void {
  const sqlite = new Database(':memory:')
  try {
    run(sqlite)
  } finally {
    sqlite.close()
  }
}

test('KAN-885/T2 applied migration metadata guard rejects absent journal without creating it', () => {
  withDatabase(sqlite => {
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table'",
    ).all()
    assert.throws(
      () => assertAcceptanceMigrationMetadata({ sqlite, projectRoot }),
      /migration|metadata|journal|missing|absent/i,
    )
    assert.deepEqual(
      sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all(),
      before,
    )
  })
})

test('KAN-885/T2 applied migration metadata guard rejects HEAD hash drift without repairs', () => {
  withDatabase(sqlite => {
    sqlite.exec(
      'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at NUMERIC)',
    )
    const insert = sqlite.prepare(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
    )
    const applied = canonicalRows()
    assert.ok(applied.length > 0)
    for (const row of applied) insert.run(row.hash, row.created_at)
    sqlite.prepare(
      'UPDATE __drizzle_migrations SET hash = ? WHERE created_at = ?',
    ).run('0'.repeat(64), applied.at(-1)!.created_at)

    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at',
    ).all()
    assert.throws(
      () => assertAcceptanceMigrationMetadata({ sqlite, projectRoot }),
      /migration|metadata|journal|hash|drift|mismatch/i,
    )
    assert.deepEqual(
      sqlite.prepare('SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at').all(),
      before,
    )
  })
})
