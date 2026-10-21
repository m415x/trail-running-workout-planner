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
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, user_id TEXT, group_id TEXT, is_active INTEGER NOT NULL, first_name TEXT, last_name TEXT, contact_email TEXT, nick_name TEXT, dni TEXT NOT NULL, birthday TEXT, phone TEXT, emergency_contact TEXT, emergency_phone TEXT, physiology TEXT, medical TEXT);
      CREATE TABLE monthly_charges (
        id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL REFERENCES athlete_profiles(id),
        billing_terms_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL,
        base_amount_minor INTEGER NOT NULL, amount_due_minor INTEGER NOT NULL,
        currency TEXT NOT NULL, base_due_date TEXT NOT NULL, effective_due_date TEXT NOT NULL,
        is_deleted INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE monthly_charge_reductions (
        id TEXT PRIMARY KEY, monthly_charge_id TEXT NOT NULL REFERENCES monthly_charges(id),
        reduction_amount_minor INTEGER NOT NULL, reason TEXT NOT NULL, created_by_user_id TEXT,
        is_current INTEGER NOT NULL, is_deleted INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE monthly_charge_extensions (
        id TEXT PRIMARY KEY, monthly_charge_id TEXT NOT NULL REFERENCES monthly_charges(id),
        extended_due_date TEXT, reason TEXT NOT NULL, created_by_user_id TEXT,
        is_current INTEGER NOT NULL, is_deleted INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO athlete_profiles (id,team_id,is_deleted,created_at,updated_at,is_active,dni) VALUES ('athlete-a','team-a',0,'2026-10-21','2026-10-21',1,'A'),('athlete-b','team-b',0,'2026-10-21','2026-10-21',1,'B');
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
    const teamBCharge = sqlite.prepare("SELECT id FROM monthly_charges WHERE athlete_id = 'athlete-b'").get() as { id: string }
    const reduction = { id: 'reduction-b', monthlyChargeId: teamBCharge.id, athleteId: 'athlete-b',
      year: 2026, month: 10, reductionAmountMinor: 1000, reason: 'Adjustment', createdByUserId: null, isCurrent: true }
    const extension = { id: 'extension-b', monthlyChargeId: teamBCharge.id, athleteId: 'athlete-b',
      year: 2026, month: 10, extendedDueDate: '2026-10-25', reason: 'Adjustment', createdByUserId: null, isCurrent: true }
    const updatedCharge = { ...charge('athlete-b'), amountDueMinor: 9000, effectiveDueDate: '2026-10-25' }
    const economicSnapshot = () => ({
      charges: sqlite.prepare('SELECT * FROM monthly_charges ORDER BY id').all(),
      reductions: sqlite.prepare('SELECT * FROM monthly_charge_reductions ORDER BY id').all(),
      extensions: sqlite.prepare('SELECT * FROM monthly_charge_extensions ORDER BY id').all(),
    })
    const beforeDeniedRevisions = economicSnapshot()
    await assert.rejects(
      repo.applyMonthlyChargeReductionAtomically('team-a', teamBCharge.id, reduction, updatedCharge),
      /outside the requested team scope/,
    )
    await assert.rejects(
      repo.applyMonthlyChargeExtensionAtomically('team-a', teamBCharge.id, extension, updatedCharge),
      /outside the requested team scope/,
    )
    assert.deepEqual(economicSnapshot(), beforeDeniedRevisions, 'foreign Team cannot mutate charge or revisions')
    await repo.applyMonthlyChargeReductionAtomically('team-b', teamBCharge.id, reduction, updatedCharge)
    await repo.applyMonthlyChargeExtensionAtomically('team-b', teamBCharge.id, extension, updatedCharge)
    assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM monthly_charge_reductions').get() as { n: number }).n, 1)
    assert.equal((sqlite.prepare('SELECT COUNT(*) AS n FROM monthly_charge_extensions').get() as { n: number }).n, 1)
    assert.equal((sqlite.prepare("SELECT amount_due_minor FROM monthly_charges WHERE athlete_id = 'athlete-b'").get() as { amount_due_minor: number }).amount_due_minor, 9000)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally { sqlite.close() }
})
