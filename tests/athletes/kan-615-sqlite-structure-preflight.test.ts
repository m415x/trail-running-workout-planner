import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileHistoricalStructureSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

function historicalDatabase(): Database.Database {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
  return sqlite
}

test('KAN-615 accepts the recognized historical AthleteProfile structure', () => {
  const sqlite = historicalDatabase()

  try {
    assertAthleteProfileHistoricalStructureSqlite(sqlite)
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects unexpected AthleteProfile columns without mutation', () => {
  const sqlite = historicalDatabase()

  try {
    sqlite.exec(
      'ALTER TABLE athlete_profiles ADD COLUMN unexpected_identity TEXT'
    )

    assert.throws(
      () => assertAthleteProfileHistoricalStructureSqlite(sqlite),
      /structure|schema|column|drift|incompatible/i
    )

    const columns = sqlite.pragma(
      'table_info(athlete_profiles)'
    ) as Array<{ name: string }>

    assert.ok(
      columns.some(column => column.name === 'unexpected_identity')
    )
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})

test('KAN-615 rejects missing historical identity uniqueness', () => {
  const sqlite = historicalDatabase()

  try {
    sqlite.exec('DROP INDEX athlete_profiles_user_id_unique')

    assert.throws(
      () => assertAthleteProfileHistoricalStructureSqlite(sqlite),
      /structure|schema|index|unique|incompatible/i
    )

    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
