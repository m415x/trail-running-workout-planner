import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { migrateAthleteProfileIdentitySqlite } from '@/db/migrations/athlete-profile-identity-sqlite'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'

test('KAN-620 ORM migrator advances canonical 0016 state through current SQLite journal head', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan620-orm-post-0016-'))
  const databasePath = join(directory, 'scenario.sqlite')

  try {
    const sqlite = new Database(databasePath)
    try {
      sqlite.pragma('foreign_keys = ON')
      migrateKan615Historical0015(sqlite)
      migrateAthleteProfileIdentitySqlite(sqlite)

      migrate(drizzle(sqlite), {
        migrationsFolder: resolve('drizzle/sqlite'),
      })

      const tables = new Set(
        (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>)
          .map(row => row.name),
      )

      assert.ok(tables.has('external_identity_links'))
      assert.ok(tables.has('team_memberships'))

      const migrationCount = (
        sqlite.prepare('SELECT COUNT(*) AS count FROM __drizzle_migrations').get() as { count: number }
      ).count

      assert.equal(migrationCount, 19)
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally {
      sqlite.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
