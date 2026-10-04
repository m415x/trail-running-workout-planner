import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileVersionedOriginSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 rejects canonical 0015 metadata attached to incomplete physical schema', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(
      readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8')
    )

    sqlite.exec(`
      CREATE TABLE __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL,
        created_at NUMERIC
      )
    `)

    const journal = JSON.parse(
      readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')
    ) as {
      entries: Array<{ tag: string; when: number }>
    }

    const head = journal.entries.findIndex(
      entry => entry.tag.startsWith('0015_')
    )
    assert.ok(head >= 0)

    const insert = sqlite.prepare(`
      INSERT INTO __drizzle_migrations (hash, created_at)
      VALUES (?, ?)
    `)

    for (const entry of journal.entries.slice(0, head + 1)) {
      const sql = readFileSync(
        `drizzle/sqlite/${entry.tag}.sql`,
        'utf8'
      )

      insert.run(
        createHash('sha256').update(sql).digest('hex'),
        entry.when
      )
    }

    const before = sqlite.prepare(`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY id
    `).all()

    assert.throws(
      () => assertAthleteProfileVersionedOriginSqlite(sqlite),
      error =>
        error instanceof Error &&
        !(error instanceof TypeError) &&
        /AthleteProfile incompatible versioned origin/i.test(error.message),
      "Expected deliberate rejection of inconsistent physical schema"
    )

    assert.deepEqual(
      sqlite.prepare(`
        SELECT hash, created_at
        FROM __drizzle_migrations
        ORDER BY id
      `).all(),
      before
    )

    assert.equal(
      sqlite.pragma('foreign_keys', { simple: true }),
      1
    )
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
