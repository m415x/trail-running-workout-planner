import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { runVerifiedCanonicalDrizzleTransaction } from '../../lib/sandbox/drizzle-transaction-boundary'

const sql = 'CREATE TABLE "synthetic_only" ("id" text)'
const secret = 'postgresql://postgres:SECRET_DRIVER_PASSWORD@127.0.0.1:54322/postgres'

test('KAN-598/C08 sanitizes driver failure before transaction callback without exposing credentials', async () => {
  let migrationInvoked = false
  let transactionCallbackInvoked = false

  await assert.rejects(() => runVerifiedCanonicalDrizzleTransaction({
    directUrl: 'postgresql://postgres:test@127.0.0.1:54322/postgres',
    expectedClusterSystemIdentifier: '1234567890123456789',
    migrationsFolder: '/workspace/project/drizzle/supabase',
    canonicalSqlInventory: [{ filename: '0000_synthetic.sql', sql }],
    loadCanonicalMigrations: () => [{
      sql: [sql],
      hash: createHash('sha256').update(sql).digest('hex'),
      folderMillis: 1,
      bps: true,
    }],
    database: {
      dialect: {
        migrate: async () => { migrationInvoked = true },
      },
      transaction: async (_callback) => {
        // Driver rejected BEGIN; no verified transaction or schema mutation exists.
        transactionCallbackInvoked = false
        throw new Error(secret)
      },
    },
  }), error => error instanceof Error
    && /transaction|sandbox|migration/i.test(error.message)
    && !error.message.includes('SECRET_DRIVER_PASSWORD'))

  assert.equal(transactionCallbackInvoked, false)
  assert.equal(migrationInvoked, false)
})
