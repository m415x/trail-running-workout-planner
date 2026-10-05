import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { createDrizzleQuickPaymentBatchReader } from '../../lib/memberships/quick-payment-drizzle-reader'

test('KAN-627 real SQLite: two bounded scoped SELECTs, active revisions and no cross-team leakage', async () => {
  const queries: string[] = []
  const sqlite = new Database(':memory:', { verbose: (sql: unknown) => {
    if (typeof sql === 'string' && /^select\b/i.test(sql.trim())) queries.push(sql)
  } })
  try {
    sqlite.exec(`
      CREATE TABLE athlete_profiles (
        id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        user_id TEXT, team_id TEXT NOT NULL, group_id TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        nick_name TEXT, dni TEXT NOT NULL DEFAULT '', birthday TEXT,
        phone TEXT, emergency_contact TEXT, emergency_phone TEXT,
        physiology TEXT, medical TEXT
      );
      CREATE TABLE monthly_charges (
        id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        athlete_id TEXT NOT NULL, billing_terms_id TEXT NOT NULL, year INTEGER NOT NULL,
        month INTEGER NOT NULL, base_amount_minor INTEGER NOT NULL,
        amount_due_minor INTEGER NOT NULL, currency TEXT NOT NULL,
        base_due_date TEXT NOT NULL, effective_due_date TEXT NOT NULL
      );
      CREATE TABLE payment_revisions (
        id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
        payment_id TEXT NOT NULL, monthly_charge_id TEXT NOT NULL,
        amount_minor INTEGER NOT NULL, payment_method TEXT NOT NULL,
        paid_at TEXT NOT NULL, voided INTEGER NOT NULL, is_current INTEGER NOT NULL
      );
      INSERT INTO athlete_profiles (id, team_id) VALUES
        ('athlete-a', 'team-1'), ('athlete-b', 'team-1'), ('athlete-foreign', 'team-2');
      INSERT INTO monthly_charges (id, athlete_id, billing_terms_id, year, month, base_amount_minor, amount_due_minor, currency, base_due_date, effective_due_date) VALUES
        ('charge-a', 'athlete-a', 'terms-a', 2026, 10, 20000, 15000, 'ARS', '2026-10-05', '2026-10-15'),
        ('charge-b', 'athlete-b', 'terms-b', 2026, 10, 10000, 10000, 'ARS', '2026-10-05', '2026-10-05'),
        ('charge-foreign', 'athlete-foreign', 'terms-f', 2026, 10, 10000, 10000, 'ARS', '2026-10-05', '2026-10-05');
      INSERT INTO payment_revisions (id, payment_id, monthly_charge_id, amount_minor, payment_method, paid_at, voided, is_current) VALUES
        ('payment-old', 'payment-a', 'charge-a', 4000, 'cash', '2026-10-01', 0, 0),
        ('payment-current', 'payment-a', 'charge-a', 6000, 'cash', '2026-10-02', 0, 1),
        ('payment-void', 'payment-b', 'charge-b', 10000, 'cash', '2026-10-03', 1, 1),
        ('payment-foreign', 'payment-f', 'charge-foreign', 9000, 'cash', '2026-10-04', 0, 1);
    `)
    const read = createDrizzleQuickPaymentBatchReader(drizzle(sqlite))
    const rows = await read({
      teamId: 'team-1',
      athleteIds: ['athlete-a', 'athlete-b', 'athlete-foreign'],
      cutoffDate: '2026-10-06',
    })
    assert.equal(queries.length, 2, 'the number of SELECTs must not grow with athletes or charges')
    assert.deepEqual(rows.map(row => row.athleteId), ['athlete-a', 'athlete-b', 'athlete-foreign'])
    assert.deepEqual(rows.map(row => row.charges.length), [1, 1, 0])
    assert.deepEqual(rows[0]?.charges.map(c => [c.id, c.remainingMinor, c.status]), [['charge-a', 9000, 'pending']])
    assert.deepEqual(rows[1]?.charges.map(c => [c.id, c.remainingMinor, c.status]), [['charge-b', 10000, 'overdue']])
    assert.equal(rows[0]?.blockedForPriorDebt, false)
    assert.equal(rows[2]?.blockedForPriorDebt, false)
  } finally {
    sqlite.close()
  }
})
