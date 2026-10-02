import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const sql = 'CREATE TABLE "athlete_groups" ("id" text);'
const canonicalSqlInventory = [{ filename: '0000_initial.sql', sql }]
const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const pin = '1234567890123456789'
const migrationsFolder = '/workspace/project/drizzle/supabase'
const validMigration = {
  sql: [sql],
  hash: createHash('sha256').update(sql).digest('hex'),
  folderMillis: 1,
  bps: true,
}

test('KAN-585 refuses altered migration statements or hashes BEFORE transaction begins', async () => {
  for (const mismatch of [
    { ...validMigration, hash: 'a'.repeat(64) },
    { ...validMigration, sql: ['CREATE TABLE "different" ("id" text);'] },
  ]) {
    let opened = false
    let migrated = false
    await assert.rejects(
      () => runVerifiedCanonicalDrizzleTransaction({
        directUrl,
        expectedClusterSystemIdentifier: pin,
        migrationsFolder,
        canonicalSqlInventory,
        database: {
          transaction: async () => { opened = true },
          dialect: { migrate: async () => { migrated = true } },
        },
        loadCanonicalMigrations: () => [mismatch],
      }),
      /canonical|correspondence|SHA256|migration/i,
    )
    assert.equal(opened, false, 'must reject mismatched migration before BEGIN')
    assert.equal(migrated, false, 'must never call canonical dialect migrator')
  }
})

test('KAN-585 accepts exact SHA256 correspondence and still enforces verified transactional preflights', async () => {
  const events: string[] = []
  await runVerifiedCanonicalDrizzleTransaction({
    directUrl,
    expectedClusterSystemIdentifier: pin,
    migrationsFolder,
    canonicalSqlInventory,
    loadCanonicalMigrations: () => [validMigration],
    database: {
      transaction: async callback => {
        events.push('BEGIN')
        await callback({
          session: {},
          execute: async statement => {
            if (statement.includes('pg_control_system()')) return [{ database: 'postgres', clusterSystemIdentifier: pin }]
            if (statement.includes('set_config(')) return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
            if (statement.includes('to_regclass(')) return [{ journal: null }]
            if (statement.includes('pg_catalog.pg_class')) return []
            if (statement.includes('current_setting(')) return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
            throw new Error('Unexpected SQL in test')
          },
        })
        events.push('COMMIT')
      },
      dialect: { migrate: async () => { events.push('MIGRATE') } },
    },
  })
  assert.deepEqual(events, ['BEGIN', 'MIGRATE', 'COMMIT'])
})
