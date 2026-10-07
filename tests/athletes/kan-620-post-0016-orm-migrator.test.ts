import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

      assert.equal(migrationCount, 20)
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
    } finally {
      sqlite.close()
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})


test('KAN-666 SQLite upgrader accepts canonical post-0016 prefix metadata with AUTOINCREMENT gaps', () => {
  const source = readFileSync(resolve('scripts/upgrade-sqlite.ts'), 'utf8')

  assert.doesNotMatch(
    source,
    /record\.id\s*!==\s*index\s*\+\s*1/,
    'AUTOINCREMENT ids are bookkeeping identities and may contain gaps after a supported metadata repair',
  )
  assert.match(
    source,
    /created_at/,
    'canonical applied-prefix validation must remain anchored by migration timestamps',
  )
  assert.match(
    source,
    /hash/,
    'canonical applied-prefix validation must remain anchored by migration hashes',
  )
})

test('KAN-666 SQLite HEAD verifier requires the H3 authorization_grants table', () => {
  const source = readFileSync(resolve('scripts/verify-sqlite.ts'), 'utf8')

  assert.match(
    source,
    /['"]authorization_grants['"]/,
    'HEAD verification must reject a database that has not applied canonical migration 0019',
  )
})


test('KAN-666 canonicalizes the dedicated 0016 hash across LF and CRLF checkouts', () => {
  const executor = readFileSync(
    resolve('db/migrations/athlete-profile-identity-sqlite.ts'),
    'utf8',
  )
  const upgrader = readFileSync(resolve('scripts/upgrade-sqlite.ts'), 'utf8')

  assert.match(
    executor,
    /migrationSql\.replace\(\/\\r\\n\/g, ['"]\\n['"]\)/,
  )
  assert.match(
    upgrader,
    /entry\.tag === ['"]0016_athlete_profile_identity['"]/,
  )
  assert.match(
    upgrader,
    /record\.hash !== canonical\.rawHash[\s\S]*record\.hash !== canonical\.canonicalHash/,
  )
})
