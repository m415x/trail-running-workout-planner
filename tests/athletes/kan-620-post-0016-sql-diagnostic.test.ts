import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateAthleteProfileIdentitySqlite } from '@/db/migrations/athlete-profile-identity-sqlite'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'

test('KAN-620 canonical 0017 and 0018 SQL apply after dedicated 0016 executor', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan620-post-0016-sql-'))
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const sqlite = new Database(databasePath)
    try {
      sqlite.pragma('foreign_keys = ON')
      migrateKan615Historical0015(sqlite)
      migrateAthleteProfileIdentitySqlite(sqlite)

      sqlite.exec(readFileSync('drizzle/sqlite/0017_natural_fabian_cortez.sql', 'utf8'))
      sqlite.exec(readFileSync('drizzle/sqlite/0018_daily_aqueduct.sql', 'utf8'))

      const tables = new Set(
        (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
          .map(row => row.name),
      )

      assert.ok(tables.has('external_identity_links'))
      assert.ok(tables.has('team_memberships'))
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally {
      sqlite.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
