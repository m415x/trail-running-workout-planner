import assert from 'node:assert/strict'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const url = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const folder = '/workspace/project/drizzle/supabase'
const marker = 'trail-running-coach-local-sandbox'

function fixture(options: { journal?: string | null; relations?: string[] } = {}) {
  const calls: string[] = []
  type CatalogRow = {
    database?: string | null
    clusterSystemIdentifier?: string | null
    environmentMarker?: string | null
    journal?: string | null
    name?: string
  }
  const database = {
    dialect: { migrate: async () => { calls.push('MIGRATE') } },
    transaction: async (callback: (tx: { session: object; execute: (sql: string) => Promise<CatalogRow[]> }) => Promise<void>) => {
      calls.push('BEGIN')
      try {
        await callback({
          session: {},
          execute: async statement => {
            if (statement.includes('pg_control_system()')) {
              calls.push('PIN')
              return [{ database: 'postgres', clusterSystemIdentifier: pin, environmentMarker: null }]
            }
            if (statement.includes('set_config(')) {
              calls.push('MARKER')
              return [{ environmentMarker: marker }]
            }
            if (statement.includes('to_regclass(')) {
              calls.push('JOURNAL')
              return [{ journal: options.journal ?? null }]
            }
            if (statement.includes('pg_catalog.pg_class')) {
              calls.push('RELATIONS')
              return (options.relations ?? []).map(name => ({ name }))
            }
            if (statement.includes('current_setting(')) {
              calls.push('READBACK')
              return [{ environmentMarker: marker }]
            }
            throw new Error('Unexpected SQL')
          },
        })
        calls.push('COMMIT')
      } catch (error) {
        calls.push('ROLLBACK')
        throw error
      }
    },
  }
  return { calls, database }
}

const source = [{
  filename: '0000_initial.sql',
  sql: 'CREATE TABLE "users" ("id" text);',
}]

function attempt(f: ReturnType<typeof fixture>) {
  return runVerifiedCanonicalDrizzleTransaction({
    directUrl: url,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder: folder,
    database: f.database,
    canonicalSqlInventory: source,
    loadCanonicalMigrations: () => [{
      sql: ['CREATE TABLE "users" ("id" text)'],
      hash: 'synthetic-hash',
      folderMillis: 1,
      bps: true,
    }],
  })
}

test('KAN-585 rejects preexisting Drizzle journal in the same transaction before migration', async () => {
  const f = fixture({ journal: 'drizzle.__drizzle_migrations' })
  await assert.rejects(() => attempt(f), /journal|migration|fresh/i)
  assert.ok(f.calls.includes('JOURNAL'), 'journal check must happen inside tx')
  assert.ok(f.calls.includes('ROLLBACK'))
  assert.ok(!f.calls.includes('MIGRATE'))
  assert.ok(!f.calls.includes('COMMIT'))
})

test('KAN-585 rejects collision on canonical table name in the same transaction', async () => {
  const f = fixture({ relations: ['users'] })
  await assert.rejects(() => attempt(f), /collision|table|migration/i)
  assert.ok(f.calls.includes('JOURNAL'))
  assert.ok(f.calls.includes('RELATIONS'))
  assert.ok(f.calls.includes('ROLLBACK'))
  assert.ok(!f.calls.includes('MIGRATE'))
})

test('KAN-585 verifies fresh journal and all table names within tx before canonical migrator', async () => {
  const f = fixture({ relations: ['supabase_unrelated_object'] })
  await attempt(f)
  assert.deepEqual(f.calls, [
    'BEGIN',
    'PIN',
    'MARKER',
    'READBACK',
    'JOURNAL',
    'RELATIONS',
    'MIGRATE',
    'COMMIT',
  ])
})

test('KAN-585 rejects absent canonical SQL inventory before opening a transaction', async () => {
  const f = fixture()
  await assert.rejects(
    () => runVerifiedCanonicalDrizzleTransaction({
      directUrl: url,
      expectedClusterSystemIdentifier: pin,
      migrationsFolder: folder,
      database: f.database,
      canonicalSqlInventory: [],
      loadCanonicalMigrations: () => [{
        sql: ['CREATE TABLE "users" ("id" text)'],
        hash: 'synthetic-hash',
        folderMillis: 1,
        bps: true,
      }],
    }),
    /canonical|inventory|migration/i,
  )
  assert.deepEqual(f.calls, [])
})
