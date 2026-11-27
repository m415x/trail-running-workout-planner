import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { assertAcceptancePhysicalSchema } from '@/scripts/acceptance-dev-physical-schema'

/**
 * Minimal column-complete fixture for the guard's required HEAD tables.
 * Deliberately lacks physical uniqueness for prescription planning scope.
 * This is a test-owned in-memory schema, never a migrated acceptance DB.
 */
function createColumnCompleteFixture(sqlite: Database.Database): void {
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
    field_performance_tests: ['reviewed_by_user_id', 'recorded_by_user_id'],
    team_economic_policies: ['id'],
    athlete_billing_terms: ['id'],
    monthly_charges: ['id'],
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
}

test('KAN-885/T2 rejects physical HEAD without unique Session + microcycle prescription index', () => {
  const sqlite = new Database(':memory:')
  try {
    createColumnCompleteFixture(sqlite)
    sqlite.pragma('query_only = ON')
    const before = sqlite.prepare(
      "SELECT name, type, sql FROM sqlite_schema ORDER BY type, name",
    ).all()

    assert.throws(
      () => assertAcceptancePhysicalSchema(sqlite),
      /schema|physical|unique|index|prescription|scope|inconsisten/i,
    )

    assert.deepEqual(
      sqlite.prepare("SELECT name, type, sql FROM sqlite_schema ORDER BY type, name").all(),
      before,
    )
  } finally {
    sqlite.close()
  }
})
