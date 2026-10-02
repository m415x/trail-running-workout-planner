import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SQL } from 'drizzle-orm/sql'

import { createVerifiedDrizzleMigrationHost } from '../../lib/sandbox/drizzle-migration-host'
import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'

test('KAN-585 binds real Drizzle SQL objects and canonical migrator to the same outer transaction session', async () => {
  const events: string[] = []
  const session = { identity: 'same-transaction-session' }
  const syntheticSql = 'CREATE TABLE "synthetic_only" ("id" text)'
  const migrations = [{ sql: [syntheticSql], hash: createHash('sha256').update(syntheticSql).digest('hex'), folderMillis: 1, bps: true }]
  const database = {
    dialect: {
      migrate: async (actualMigrations: typeof migrations, actualSession: typeof session) => {
        events.push('migrate')
        assert.equal(actualMigrations, migrations)
        assert.equal(actualSession, session)
      },
    },
    transaction: async (callback: (tx: { session: typeof session; execute: (statement: SQL) => Promise<unknown> }) => Promise<void>) => {
      events.push('begin')
      await callback({
        session,
        execute: async statement => {
          assert.ok(statement instanceof SQL)
          const query = new PgDialect().sqlToQuery(statement).sql
          if (query.includes('pg_control_system()')) {
            events.push('pin-check')
            return [{ database: 'postgres', clusterSystemIdentifier: pin, environmentMarker: null }]
          }
          if (query.includes('set_config(')) {
            events.push('set-marker')
            return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
          }
          if (query.includes('to_regclass(')) {
            events.push('journal-check')
            return [{ journal: null }]
          }
          if (query.includes('pg_catalog.pg_class')) {
            events.push('collision-check')
            return []
          }
          if (query.includes('current_setting(')) {
            events.push('marker-readback')
            return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
          }
          throw new Error('Unexpected SQL')
        },
      })
      events.push('commit')
    },
  }
  await runVerifiedCanonicalDrizzleTransaction({
    directUrl: localUrl,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder: '/workspace/project/drizzle/supabase',
    canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql: 'CREATE TABLE "synthetic_only" ("id" text)' }],
    database: createVerifiedDrizzleMigrationHost(database),
    loadCanonicalMigrations: () => migrations,
  })
  assert.deepEqual(events, ['begin', 'pin-check', 'set-marker', 'marker-readback', 'journal-check', 'collision-check', 'migrate', 'commit'])
})

test('KAN-585 cannot migrate when transaction identity query fails, and never reopens a connection', async () => {
  const events: string[] = []
  const database = {
    dialect: { migrate: async () => { events.push('migrate') } },
    transaction: async (callback: (tx: { session: object; execute: (statement: SQL) => Promise<unknown> }) => Promise<void>) => {
      events.push('begin')
      try {
        await callback({
          session: {},
          execute: async () => { throw new Error('postgresql://postgres:PRIVATE@127.0.0.1') },
        })
      } catch (error) {
        events.push('rollback')
        throw error
      }
    },
  }
  await assert.rejects(
    () => runVerifiedCanonicalDrizzleTransaction({
      directUrl: localUrl,
      expectedClusterSystemIdentifier: pin,
      migrationsFolder: '/workspace/project/drizzle/supabase',
      canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql: 'CREATE TABLE "synthetic_only" ("id" text)' }],
    database: createVerifiedDrizzleMigrationHost(database),
      loadCanonicalMigrations: () => [{ sql: ['CREATE TABLE "synthetic_only" ("id" text)'], hash: createHash('sha256').update('CREATE TABLE "synthetic_only" ("id" text)').digest('hex'), folderMillis: 1, bps: true }],
    }),
    (error: unknown) => error instanceof Error && !error.message.includes('PRIVATE'),
  )
  assert.deepEqual(events, ['begin', 'rollback'])
})
