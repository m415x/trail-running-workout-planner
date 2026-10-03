import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const sql = 'CREATE TABLE "sandbox_contract_fixture" ("id" integer);'
const migration = {
  sql: [sql],
  hash: createHash('sha256').update(sql).digest('hex'),
  folderMillis: 1,
  bps: true,
}

test('KAN-598/C18 preexisting Drizzle relation aborts before catalog collision and dialect migration', async () => {
  const visited: string[] = []
  let migrationCalls = 0
  let transactionCompleted = false

  await assert.rejects(
    () => runVerifiedCanonicalDrizzleTransaction({
      directUrl: 'postgresql://postgres:synthetic@127.0.0.1:54322/postgres',
      expectedClusterSystemIdentifier: '123456',
      migrationsFolder: '/synthetic/canonical/drizzle/supabase',
      canonicalSqlInventory: [{ filename: '0000_contract.sql', sql }],
      loadCanonicalMigrations: () => [migration],
      database: {
        dialect: {
          migrate: async () => { migrationCalls += 1 },
        },
        transaction: async callback => {
          await callback({
            session: { synthetic: true },
            execute: async statement => {
              visited.push(statement)
              if (statement.includes('pg_control_system()')) {
                return [{
                  database: 'postgres',
                  environmentMarker: null,
                  clusterSystemIdentifier: '123456',
                }]
              }
              if (statement.includes('set_config(') || statement.includes('current_setting(')) {
                return [{ environmentMarker: 'trail-running-coach-local-sandbox' }]
              }
              if (statement.includes('to_regclass(')) return [{ journal: null }]
              if (statement.includes('pg_catalog.pg_class') && statement.includes("n.nspname = 'drizzle'")) {
                return [{ name: 'unexpected_preexisting_relation' }]
              }
              if (statement.includes("n.nspname = 'public'")) {
                throw new Error('public catalog must not be reached')
              }
              throw new Error('unexpected synthetic statement')
            },
          })
          transactionCompleted = true
        },
      },
    }),
    /Drizzle namespace preflight failed/,
  )

  assert.equal(migrationCalls, 0)
  assert.equal(transactionCompleted, false)
  assert.ok(visited.some(statement => statement.includes("n.nspname = 'drizzle'")))
  assert.equal(visited.some(statement => statement.includes("n.nspname = 'public'")), false)
})
