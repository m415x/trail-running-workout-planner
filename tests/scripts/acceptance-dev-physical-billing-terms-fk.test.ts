import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'

test('KAN-885/T2 rejects monthly charges without billing terms RESTRICT foreign key', () => {
  const sqlite = new Database(':memory:')
  try {
    const tables: Record<string, string[]> = {
      users: ['id', 'is_deleted', 'user_name', 'email'],
      external_identity_links: ['id', 'is_deleted', 'user_id', 'provider', 'subject'],
      teams: ['id', 'is_deleted'],
      team_memberships: ['id', 'is_deleted', 'user_id', 'team_id', 'preset', 'is_active', 'effective_from', 'effective_until'],
      athlete_profiles: ['id', 'is_deleted', 'user_id', 'team_id'],
      athlete_groups: ['id', 'is_deleted', 'team_id'],
      sessions: ['id', 'is_deleted', 'team_id', 'date', 'generation_ownership'],
      group_session_prescriptions: ['id', 'is_deleted', 'session_id', 'group_id', 'microcycle_id', 'generation_ownership'],
      microcycles: ['id', 'is_deleted', 'mesocycle_id'],
      authorization_grants: ['id'],
      team_economic_policies: ['id'],
      athlete_billing_terms: ['id'],
      monthly_charges: ['id', 'athlete_id', 'year', 'month', 'billing_terms_id'],
      global_monthly_due_date_exceptions: ['id'],
      monthly_charge_reductions: ['id'],
      monthly_charge_extensions: ['id'],
      payment_revisions: ['id'],
      microcycle_intensity_targets: ['reference_percentage_target'],
      session_generation_modification_records: ['generation_explanation'],
    }
    for (const [table, columns] of Object.entries(tables)) {
      sqlite.exec(`CREATE TABLE "${table}" (${columns.map(column => `"${column}" TEXT`).join(', ')})`)
    }
    sqlite.exec(`
      CREATE TABLE field_performance_tests (
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX group_session_prescriptions_session_microcycle_unique
        ON group_session_prescriptions(session_id, microcycle_id);
      CREATE UNIQUE INDEX monthly_charges_athlete_year_month_unique
        ON monthly_charges(athlete_id, year, month);
    `)

    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      "SELECT name, type, sql FROM sqlite_schema ORDER BY type, name",
    ).all()

    assert.throws(
      () => assertAcceptancePhysicalSchema(sqlite),
      /monthly_charges|billing_terms_id|athlete_billing_terms|foreign|restrict|physical|schema/i,
    )

    assert.deepEqual(
      sqlite.prepare("SELECT name, type, sql FROM sqlite_schema ORDER BY type, name").all(),
      before,
    )
  } finally {
    sqlite.close()
  }
})
