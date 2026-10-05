import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import {
  assertAthleteProfileVersionedOriginSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 creates isolated canonical historical 0015 origin', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')

    migrateKan615Historical0015(sqlite)

    assertAthleteProfileVersionedOriginSqlite(sqlite)

    const rows = sqlite.prepare(`
      SELECT created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all() as Array<{ created_at: number }>

    assert.equal(rows.length, 16)
    assert.equal(rows.at(-1)?.created_at, 1790802000000)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
  } finally {
    sqlite.close()
  }
})
