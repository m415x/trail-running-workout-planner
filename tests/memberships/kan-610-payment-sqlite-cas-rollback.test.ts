import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'

test('KAN-731 SQLite payment revision CAS rejects stale replay and rolls back a failed successor', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  try {
    sqlite.exec([
      'CREATE TABLE users (id text PRIMARY KEY)',
      'CREATE TABLE monthly_charges (id text PRIMARY KEY)',
      'CREATE TABLE payment_revisions (id text PRIMARY KEY, payment_id text NOT NULL, monthly_charge_id text NOT NULL REFERENCES monthly_charges(id), amount_minor integer NOT NULL, payment_method text NOT NULL, paid_at text NOT NULL, voided integer NOT NULL, is_current integer NOT NULL, is_deleted integer NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, created_by_user_id text REFERENCES users(id) ON DELETE RESTRICT)',
      "INSERT INTO users VALUES ('coach-1')",
      "INSERT INTO users VALUES ('coach-2')",
      "INSERT INTO monthly_charges VALUES ('charge-1')",
      "INSERT INTO payment_revisions VALUES ('rev-1','payment-1','charge-1',100,'cash','2026-10-10',0,1,0,'2026-10-10','2026-10-10','coach-1')",
    ].join(';') + ';')
    const adapter = createDrizzleBillingDatabase(drizzle(sqlite))
    if (!adapter.replaceCurrentPaymentRevisionAtomically) throw new Error('Missing replacement port')
    const first = { revisionId: 'rev-1', paymentId: 'payment-1', monthlyChargeId: 'charge-1', amountMinor: 100, paymentMethod: 'cash' as const, paidAt: '2026-10-10', voided: false, isCurrent: true, createdByUserId: 'coach-1' }
    await adapter.replaceCurrentPaymentRevisionAtomically(first, { ...first, revisionId: 'rev-2', amountMinor: 120, createdByUserId: 'coach-2' })
    await assert.rejects(adapter.replaceCurrentPaymentRevisionAtomically(first, { ...first, revisionId: 'rev-stale', createdByUserId: 'coach-1' }), /no longer current/)
    const current = { ...first, revisionId: 'rev-2', amountMinor: 120, createdByUserId: 'coach-2' }
    await assert.rejects(adapter.replaceCurrentPaymentRevisionAtomically(current, { ...current, revisionId: 'rev-invalid', createdByUserId: 'missing-user' }), /FOREIGN KEY/)
    const rows = sqlite.prepare('SELECT id, is_current, created_by_user_id FROM payment_revisions ORDER BY id').all() as Array<{ id: string; is_current: number; created_by_user_id: string | null }>
    assert.deepEqual(rows.map(r => [r.id, r.is_current, r.created_by_user_id]), [['rev-1', 0, 'coach-1'], ['rev-2', 1, 'coach-2']])
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally { sqlite.close() }
})
