import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 refuses migration from unversioned 0000 without mutation', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    sqlite.exec(
      readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'),
    )

    const before = sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `).all()

    assert.throws(
      () => migrateAthleteProfileIdentitySqlite(sqlite),
      error =>
        error instanceof Error &&
        !(error instanceof TypeError) &&
        /AthleteProfile.*(precondition|origin|incompatible)/i
          .test(error.message),
      'Expected deliberate rejection of an unversioned origin',
    )

    assert.deepEqual(
      sqlite.prepare(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%'
        ORDER BY type, name
      `).all(),
      before,
    )

    assert.equal(sqlite.inTransaction, false)
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
