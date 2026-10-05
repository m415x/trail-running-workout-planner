import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'

test('KAN-633 actual SQLite batch selects revisions in one bounded SELECT, without other charges', async () => {
  const selected: string[] = []
  const sqlite = new Database(':memory:', {
    verbose: (statement: unknown) => {
      if (typeof statement === 'string' && /^select\b/i.test(statement.trim())) selected.push(statement)
    },
  })
  try {
    sqlite.exec(`
      CREATE TABLE payment_revisions (
        id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        payment_id TEXT NOT NULL, monthly_charge_id TEXT NOT NULL,
        amount_minor INTEGER NOT NULL, payment_method TEXT NOT NULL,
        paid_at TEXT NOT NULL, voided INTEGER NOT NULL, is_current INTEGER NOT NULL
      );
      INSERT INTO payment_revisions (id, payment_id, monthly_charge_id, amount_minor, payment_method, paid_at, voided, is_current)
      VALUES
        ('r1', 'p1', 'c1', 200, 'cash', '2026-10-01', 0, 1),
        ('r2', 'p2', 'c2', 300, 'bank_transfer', '2026-10-02', 0, 1),
        ('foreign', 'p3', 'foreign-charge', 500, 'cash', '2026-10-03', 0, 1);
    `)
    const db = createDrizzleBillingDatabase(drizzle(sqlite))
    assert.equal(typeof db.listPaymentRevisionsForCharges, 'function')
    const rows = await db.listPaymentRevisionsForCharges!(['c1', 'c2'])
    assert.equal(selected.length, 1, 'query count must not depend on number of requested charges')
    assert.deepEqual(rows.map(row => [row.monthlyChargeId, row.amountMinor]).sort(), [['c1', 200], ['c2', 300]])
    selected.length = 0
    assert.deepEqual(await db.listPaymentRevisionsForCharges!([]), [])
    assert.equal(selected.length, 0, 'empty set must not scan all payment revisions')
  } finally {
    sqlite.close()
  }
})
