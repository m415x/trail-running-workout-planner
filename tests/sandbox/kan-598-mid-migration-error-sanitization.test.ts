import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const directUrl = 'postgresql://postgres:placeholder@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const folder = '/workspace/project/drizzle/supabase'
const sql = 'CREATE TABLE "synthetic_only" ("id" text)'
const migration = {
  sql: [sql],
  hash: createHash('sha256').update(sql).digest('hex'),
  folderMillis: 1,
  bps: true,
}

test('KAN-598/C07 aborts transaction after mid-migration failure and never leaks driver secrets', async () => {
  const events: string[] = []
  const session = { name: 'one-session' }
  const driverSecret = 'postgresql://private-credentials@remote.invalid/secret'
  let committed = false
  const database = {
    dialect: {
      migrate: async (_: unknown, receivedSession: unknown) => {
        assert.equal(receivedSession, session)
        events.push('migrate')
        throw new Error(driverSecret)
      },
    },
    transaction: async (callback: (tx: {
      session: typeof session
      execute: (statement: string) => Promise<unknown[]>
    }) => Promise<void>) => {
      events.push('begin')
      try {
        await callback({
          session,
          execute: async statement => {
            if (statement.includes('pg_control_system()')) {
              events.push('physical')
              return [{ database: 'postgres', clusterSystemIdentifier: pin, environmentMarker: null }]
            }
            if (statement.includes('set_config(')) return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
            if (statement.includes('current_setting(')) return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
            if (statement.includes('to_regclass(')) return [{ journal: null }]
            if (statement.includes('pg_catalog.pg_class')) return []
            throw new Error('Unexpected statement')
          },
        })
        committed = true
        events.push('commit')
      } catch (error) {
        events.push('rollback')
        throw error
      }
    },
  }

  await assert.rejects(() => runVerifiedCanonicalDrizzleTransaction({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder: folder,
    canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql }],
    loadCanonicalMigrations: () => [migration],
    database,
  }), error => error instanceof Error
    && /migration|drizzle|sandbox/i.test(error.message)
    && !error.message.includes(driverSecret))

  assert.equal(committed, false)
  assert.deepEqual(events, ['begin', 'physical', 'migrate', 'rollback'])
})
