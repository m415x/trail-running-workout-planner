import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'

test('KAN-845 real Drizzle charge insertion respects persisted Athlete Team and has zero foreign writes', async () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  try {
    sqlite.exec(`
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL);
      CREATE TABLE monthly_charges (
        id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL REFERENCES athlete_profiles(id),
        billing_terms_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
        base_amount_minor INTEGER NOT NULL, amount_due_minor INTEGER NOT NULL,
        currency TEXT NOT NULL, base_due_date TEXT NOT NULL, effective_due_date TEXT NOT NULL,
        is_deleted INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO athlete_profiles VALUES ('athlete-a','team-a',0),('athlete-b','team-b',0);
    `)
    const repo = createDrizzleBillingDatabase(drizzle(sqlite))
    const charge = (athleteId: string) => ({
      athleteId, billingTermsId: 'terms-' + athleteId,
      year: 2026, month: 10, baseAmountMinor: 10000, amountDueMinor: 10000,
      currency: 'ARS', baseDueDate: '2026-10-10', effectiveDueDate: '2026-10-10',
    })
    const snapshot = () => sqlite.prepare(
      'SELECT athlete_id, billing_terms_id, amount_due_minor FROM monthly_charges ORDER BY athlete_id'
    ).all()
    await repo.insertMonthlyCharges('team-b', 'athlete-b', [charge('athlete-b')])
    assert.deepEqual(snapshot(), [{
      athlete_id: 'athlete-b', billing_terms_id: 'terms-athlete-b', amount_due_minor: 10000,
    }])
    const baseline = snapshot()
    await assert.rejects(
      repo.insertMonthlyCharges('team-a', 'athlete-b', [charge('athlete-b')]),
      /Athlete does not belong to the requested team/,
    )
    assert.deepEqual(snapshot(), baseline, 'foreign Athlete cannot insert a Charge')
    await assert.rejects(
      repo.insertMonthlyCharges('team-b', 'athlete-b', [charge('athlete-a')]),
      /Monthly charge athlete is outside the requested athlete scope/,
    )
    assert.deepEqual(snapshot(), baseline, 'foreign Charge payload cannot mutate Team B')
    sqlite.prepare("UPDATE athlete_profiles SET is_deleted = 1 WHERE id = 'athlete-a'").run()
    await assert.rejects(
      repo.insertMonthlyCharges('team-a', 'athlete-a', [charge('athlete-a')]),
      /Athlete does not belong to the requested team/,
    )
    assert.deepEqual(snapshot(), baseline, 'soft-deleted Athlete cannot receive a Charge')
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally { sqlite.close() }
})
