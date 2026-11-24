import type Database from 'better-sqlite3'

/**
 * KAN-885/T2 RED-6: read-only physical-shape guard for the acceptance runtime.
 *
 * This is a necessary (not sufficient) check: migration history/journal hashes,
 * SQLite integrity, actor membership and authentic Supabase H2 are independently
 * accredited by their respective preflights. No schema repair or DDL is performed.
 */
const requiredColumns: Readonly<Record<string, readonly string[]>> = {
  users: ['id', 'is_deleted', 'user_name', 'email'],
  external_identity_links: ['id', 'is_deleted', 'user_id', 'provider', 'subject'],
  teams: ['id', 'is_deleted'],
  team_memberships: [
    'id', 'is_deleted', 'user_id', 'team_id', 'preset',
    'is_active', 'effective_from', 'effective_until',
  ],
  athlete_profiles: ['id', 'is_deleted', 'user_id', 'team_id'],
  athlete_groups: ['id', 'is_deleted', 'team_id'],
  sessions: ['id', 'is_deleted', 'team_id', 'date', 'generation_ownership'],
  group_session_prescriptions: [
    'id', 'is_deleted', 'session_id', 'group_id', 'microcycle_id',
    'generation_ownership',
  ],
  microcycles: ['id', 'is_deleted', 'mesocycle_id'],
  // Tables also required by the checkout's existing scripts/verify-sqlite.ts.
  authorization_grants: [],
  field_performance_tests: ['reviewed_by_user_id', 'recorded_by_user_id'],
  team_economic_policies: [],
  athlete_billing_terms: [],
  monthly_charges: [],
  global_monthly_due_date_exceptions: [],
  monthly_charge_reductions: [],
  monthly_charge_extensions: [],
  payment_revisions: [],
  microcycle_intensity_targets: ['reference_percentage_target'],
  session_generation_modification_records: ['generation_explanation'],
}

/**
 * The caller must provide an already-open read-only/query_only connection.
 * PRAGMA table_xinfo is a read-only inspection and exposes generated columns.
 */
export function assertAcceptancePhysicalSchema(sqlite: Database.Database): void {
  for (const [table, columns] of Object.entries(requiredColumns)) {
    const tableRow = sqlite.prepare(
      "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?",
    ).get(table)
    if (!tableRow) {
      throw new Error(`KAN-885: physical SQLite schema missing table ${table}`)
    }

    // Every identifier below is internal and static, never user-controlled.
    const actual = new Set(
      (sqlite.pragma(`table_xinfo('${table}')`) as Array<{ name: string }>)
        .map(column => column.name),
    )
    const missing = columns.filter(column => !actual.has(column))
    if (missing.length > 0) {
      throw new Error(
        `KAN-885: physical SQLite schema missing columns in ${table}: ${missing.join(', ')}`,
      )
    }
  }
}
