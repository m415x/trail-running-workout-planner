import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileVersionedOriginSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 accepts actual versioned historical origin 0015', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')

    migrateKan615Historical0015(sqlite)

    const columns = sqlite.pragma(
      'table_info(athlete_profiles)',
    ) as Array<{ name: string }>

    assert.equal(columns.length, 16)

    const incoming = sqlite.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>

    const referencingTables = incoming.filter(({ name }) => {
      const safeName = name.replace(/"/g, '""')
      const foreignKeys = sqlite.pragma(
        `foreign_key_list("${safeName}")`,
      ) as Array<{ table: string }>

      return foreignKeys.some(
        fk => fk.table === 'athlete_profiles',
      )
    })

    assert.equal(referencingTables.length, 12)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)

    console.log("KAN615_METADATA_COLUMNS", JSON.stringify(
      sqlite.pragma("table_info(__drizzle_migrations)")
    ))
    console.log("KAN615_METADATA_DDL", JSON.stringify(
      sqlite.prepare("SELECT sql FROM sqlite_master WHERE type = ? AND name = ?")
        .get("table", "__drizzle_migrations")
    ))
    console.log("KAN615_METADATA_INDEXES", JSON.stringify(
      sqlite.pragma("index_list(__drizzle_migrations)")
    ))
    console.log("KAN615_METADATA_ROWS", JSON.stringify(
      sqlite.prepare(
        "SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id"
      ).all()
    ))
    assertAthleteProfileVersionedOriginSqlite(sqlite)
  } finally {
    sqlite.close()
  }
})
