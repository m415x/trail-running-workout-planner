import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileMigrationHistorySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

type Entry = { tag: string; when: number }

const journal = JSON.parse(
  readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8'),
) as { entries: Entry[] }

const headIndex = journal.entries.findIndex(
  entry => entry.tag.startsWith('0015_'),
)

assert.ok(headIndex >= 0, 'Missing historical migration 0015')

const history = journal.entries.slice(0, headIndex + 1)

function fixture(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')

  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL,
      created_at NUMERIC
    )
  `)

  const insert = sqlite.prepare(`
    INSERT INTO __drizzle_migrations (hash, created_at)
    VALUES (?, ?)
  `)

  for (const entry of history) {
    const sql = readFileSync(
      `drizzle/sqlite/${entry.tag}.sql`,
      'utf8',
    )

    const hash = createHash('sha256')
      .update(sql)
      .digest('hex')

    insert.run(hash, entry.when)
  }

  return sqlite
}

test('KAN-615 recognizes exact canonical migration history through 0015', () => {
  const sqlite = fixture()

  try {
    assertAthleteProfileMigrationHistorySqlite(sqlite)

    assert.equal(
      (
        sqlite.prepare(
          'SELECT COUNT(*) AS count FROM __drizzle_migrations',
        ).get() as { count: number }
      ).count,
      history.length,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects a missing historical migration', () => {
  const sqlite = fixture()

  try {
    sqlite.prepare(
      'DELETE FROM __drizzle_migrations WHERE created_at = ?',
    ).run(history[history.length - 2].when)

    assert.throws(
      () => assertAthleteProfileMigrationHistorySqlite(sqlite),
      /migration|metadata|history|drift|incompatible/i,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects a corrupted canonical migration hash', () => {
  const sqlite = fixture()

  try {
    sqlite.prepare(
      'UPDATE __drizzle_migrations SET hash = ? WHERE created_at = ?',
    ).run('corrupted-hash', history[history.length - 1].when)

    assert.throws(
      () => assertAthleteProfileMigrationHistorySqlite(sqlite),
      /migration|metadata|hash|drift|incompatible/i,
    )
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects an unexpected extra metadata row', () => {
  const sqlite = fixture()

  try {
    sqlite.prepare(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (?, ?)
    `).run('unexpected', 9999999999999)

    assert.throws(
      () => assertAthleteProfileMigrationHistorySqlite(sqlite),
      /migration|metadata|history|drift|incompatible/i,
    )
  } finally {
    sqlite.close()
  }
})
