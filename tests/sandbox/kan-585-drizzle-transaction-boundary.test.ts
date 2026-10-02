import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const marker = 'trail-running-coach-local-sandbox'
const migrationFolder = '/workspace/project/drizzle/supabase'

function fixture(physical = pin) {
  const events: string[] = []
  const session = { unique: 'outer-drizzle-transaction-session' }
  type IdentityRow = {
    database?: string | null
    clusterSystemIdentifier?: string | null
    environmentMarker?: string | null
    journal?: string | null
    name?: string
  }
  type FakeTransaction = {
    session: typeof session
    execute: (sql: string) => Promise<IdentityRow[]>
  }
  const syntheticSql = 'CREATE TABLE "synthetic_only" ("id" text)'
  const migrations = [{ sql: [syntheticSql], hash: createHash('sha256').update(syntheticSql).digest('hex'), folderMillis: 1, bps: true }]
  return {
    events,
    migrations,
    database: {
      dialect: {
        migrate: async (items: unknown, actualSession: unknown, config: unknown) => {
          events.push('canonical-drizzle-migrate')
          assert.equal(items, migrations)
          assert.equal(actualSession, session)
          assert.deepEqual(config, { migrationsFolder: migrationFolder })
        },
      },
      transaction: async (callback: (tx: FakeTransaction) => Promise<unknown>) => {
        events.push('begin')
        try {
          const result = await callback({
            session,
            execute: async (sql: string) => {
              if (sql.includes('pg_control_system()')) {
                events.push('read-physical')
                return [{ database: 'postgres', clusterSystemIdentifier: physical, environmentMarker: null }]
              }
              if (sql.includes('set_config(')) {
                events.push('set-local-marker')
                return [{ environmentMarker: marker }]
              }
              if (sql.includes('to_regclass(')) {
                events.push('check-journal')
                return [{ journal: null }]
              }
              if (sql.includes('pg_catalog.pg_class')) {
                events.push('check-collisions')
                return []
              }
              if (sql.includes('current_setting(')) {
                events.push('read-local-marker')
                return [{ environmentMarker: marker }]
              }
              throw new Error('Unexpected SQL statement')
            },
          })
          events.push('commit')
          return result
        } catch (error) {
          events.push('rollback')
          throw error
        }
      },
    },
    loadCanonicalMigrations: (path: string) => {
      events.push('load-canonical-migrations')
      assert.equal(path, migrationFolder)
      return migrations
    },
  }
}

test('KAN-585 executes canonical Drizzle migrator only after pin+marker verification in the same transaction session', async () => {
  const f = fixture()
  await runVerifiedCanonicalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder: migrationFolder,
    database: f.database,
    canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql: 'CREATE TABLE "synthetic_only" ("id" text)' }],
    loadCanonicalMigrations: f.loadCanonicalMigrations,
  })
  assert.deepEqual(f.events, [
    'load-canonical-migrations',
    'begin',
    'read-physical',
    'set-local-marker',
    'read-local-marker',
    'check-journal',
    'check-collisions',
    'canonical-drizzle-migrate',
    'commit',
  ])
})

test('KAN-585 rolls back and never invokes Drizzle migration on physical mismatch', async () => {
  const f = fixture('different-cluster')
  await assert.rejects(() => runVerifiedCanonicalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder: migrationFolder,
    database: f.database,
    canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql: 'CREATE TABLE "synthetic_only" ("id" text)' }],
    loadCanonicalMigrations: f.loadCanonicalMigrations,
  }), /cluster|identity|sandbox/i)
  assert.deepEqual(f.events, ['load-canonical-migrations', 'begin', 'read-physical', 'rollback'])
})

test('KAN-585 rejects unapproved destination and missing pin before loading migrations or starting transaction', async () => {
  for (const request of [
    { directUrl: 'postgresql://postgres:secret@db.example.com:5432/postgres', expectedClusterSystemIdentifier: pin },
    { directUrl: localUrl, expectedClusterSystemIdentifier: undefined },
  ]) {
    const f = fixture()
    await assert.rejects(() => runVerifiedCanonicalDrizzleTransaction({
      ...request,
      migrationsFolder: migrationFolder,
      database: f.database,
      canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql: 'CREATE TABLE "synthetic_only" ("id" text)' }],
    loadCanonicalMigrations: f.loadCanonicalMigrations,
    }), /local|pin|cluster|sandbox/i)
    assert.deepEqual(f.events, [])
  }
})
