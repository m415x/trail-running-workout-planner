import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'

test('KAN-885/T2 rejects legacy PAM target column even when required HEAD and H7A schema is valid', () => {
  const sqlite = new Database(':memory:')
  try {
    const base: Record<string, string[]> = {
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
      session_generation_modification_records: ['generation_explanation'],
    }
    for (const [table, columns] of Object.entries(base)) {
      sqlite.exec(`CREATE TABLE "${table}" (${columns.map(column => `"${column}" TEXT`).join(', ')})`)
    }

    const authorTables = [
      'team_economic_policies', 'athlete_billing_terms',
      'global_monthly_due_date_exceptions', 'monthly_charge_reductions',
      'monthly_charge_extensions', 'payment_revisions',
    ]
    for (const table of authorTables) {
      sqlite.exec(`CREATE TABLE "${table}" (
        id TEXT, created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT
      )`)
    }
    sqlite.exec(`
      CREATE TABLE field_performance_tests (
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        recorded_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE TABLE monthly_charges (
        id TEXT, athlete_id TEXT, year INTEGER, month INTEGER,
        billing_terms_id TEXT REFERENCES athlete_billing_terms(id) ON DELETE RESTRICT
      );
      CREATE TABLE microcycle_intensity_targets (
        reference_percentage_target REAL,
        pam_percentage_target REAL
      );
      CREATE TABLE field_performance_test_events (
        id TEXT NOT NULL PRIMARY KEY,
        is_deleted INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,
        scheduled_at TEXT NOT NULL,
        protocol TEXT NOT NULL CHECK (protocol = '1000m_track'),
        created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT
      );
      CREATE INDEX field_performance_test_events_team_group_date_idx
        ON field_performance_test_events(team_id, group_id, scheduled_at);
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
      /pam_percentage_target|legacy|obsolete|incompatible|drift/i,
    )
    assert.deepEqual(
      sqlite.prepare("SELECT name, type, sql FROM sqlite_schema ORDER BY type, name").all(),
      before,
    )
  } finally {
    sqlite.close()
  }
})
