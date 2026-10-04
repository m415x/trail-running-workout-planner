import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'
import {
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

function snapshot(sqlite: Database.Database) {
  const schema = sqlite.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    ORDER BY type, name
  `).all()

  const tables = sqlite.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
    ORDER BY name
  `).all() as Array<{ name: string }>

  return {
    schema,
    data: Object.fromEntries(
      tables.map(({ name }) => [
        name,
        sqlite.prepare(
          `SELECT * FROM "${name}" ORDER BY rowid`,
        ).all(),
      ]),
    ),
  }
}

test('KAN-615 rejects pre-existing partial reconstruction artifact', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'kan615-partial-'),
  )

  const databasePath = join(directory, 'scenario.sqlite')
  let sqlite: Database.Database | undefined

  try {
    sqlite = new Database(databasePath)
    sqlite.pragma('foreign_keys = ON')

    migrateKan615Historical0015(sqlite)
    seedKan615PreservationData(sqlite)

    // Simulate a pre-existing artifact. This is not a valid
    // committed result of the dedicated transaction.
    sqlite.exec(`
      CREATE TABLE "__new_athlete_profiles" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "marker" TEXT NOT NULL
      );

      INSERT INTO "__new_athlete_profiles" (id, marker)
      VALUES ('foreign-artifact', 'preserve-me');
    `)

    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

    const before = snapshot(sqlite)

    assert.throws(
      () => migrateAthleteProfileIdentitySqlite(sqlite!),
      error =>
        error instanceof Error &&
        /AthleteProfile incompatible.*partial/i.test(error.message),
      'Reserved reconstruction artifact must be rejected explicitly',
    )

    assert.deepEqual(snapshot(sqlite), before)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

    assert.equal(sqlite.inTransaction, false)
    assert.equal(
      sqlite.pragma('foreign_keys', { simple: true }),
      1,
    )

    const marker = sqlite.prepare(`
      SELECT marker
      FROM "__new_athlete_profiles"
      WHERE id = ?
    `).get('foreign-artifact') as { marker: string }

    assert.equal(marker.marker, 'preserve-me')

    const count = sqlite.prepare(`
      SELECT COUNT(*) AS count
      FROM __drizzle_migrations
    `).get() as { count: number }

    assert.equal(count.count, 16)
  } finally {
    if (sqlite?.open) sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
