import type Database from 'better-sqlite3'
import { auditH7aPhysicalSchema } from '@/scripts/h7a-physical-schema'

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
    if (table === 'microcycle_intensity_targets' && actual.has('pam_percentage_target')) {
      throw new Error(
        'KAN-885: physical SQLite legacy microcycle_intensity_targets.pam_percentage_target must not remain',
      )
    }
    if (missing.length > 0) {
      throw new Error(
        `KAN-885: physical SQLite schema missing columns in ${table}: ${missing.join(', ')}`,
      )
    }
  }

  // Canonical planning-scope uniqueness is required by scripts/verify-sqlite.ts.
  const prescriptionIndexes = sqlite.pragma(
    'index_list(group_session_prescriptions)',
  ) as Array<{ name: string; unique: number }>
  const planningIndex = prescriptionIndexes.find(
    index => index.name === 'group_session_prescriptions_session_microcycle_unique',
  )
  if (planningIndex?.unique !== 1) {
    throw new Error(
      'KAN-885: physical SQLite schema missing unique prescription Session + microcycle index',
    )
  }
  if (prescriptionIndexes.some(
    index => index.name === 'group_session_prescriptions_session_group_unique',
  )) {
    throw new Error('KAN-885: physical SQLite schema retains legacy prescription scope index')
  }

  const indexedColumns = (sqlite.pragma(
    'index_info(group_session_prescriptions_session_microcycle_unique)',
  ) as Array<{ seqno: number; name: string }>)
    .sort((left, right) => left.seqno - right.seqno)
    .map(column => column.name)

  if (
    indexedColumns.length !== 2
    || indexedColumns[0] !== 'session_id'
    || indexedColumns[1] !== 'microcycle_id'
  ) {
    throw new Error('KAN-885: physical SQLite prescription scope index has incompatible columns')
  }

  // Reviewed field-performance results must retain the canonical restrictive
  // reference to an existing user; column presence alone cannot prove this.
  const performanceForeignKeys = sqlite.pragma(
    'foreign_key_list(field_performance_tests)',
  ) as Array<{ table: string; from: string; to: string; on_delete: string }>
  const reviewedByForeignKey = performanceForeignKeys.find(
    foreignKey => foreignKey.from === 'reviewed_by_user_id',
  )
  if (
    reviewedByForeignKey?.table !== 'users'
    || reviewedByForeignKey.to !== 'id'
    || reviewedByForeignKey.on_delete.toUpperCase() !== 'RESTRICT'
  ) {
    throw new Error(
      'KAN-885: physical SQLite field_performance_tests.reviewed_by_user_id must reference users(id) ON DELETE RESTRICT',
    )
  }

  // One monthly charge per athlete and calendar month is enforced physically.
  const monthlyChargeIndexes = sqlite.pragma(
    'index_list(monthly_charges)',
  ) as Array<{ name: string; unique: number }>
  const monthlyChargeUniqueIndex = monthlyChargeIndexes.find(
    index => index.name === 'monthly_charges_athlete_year_month_unique',
  )
  if (monthlyChargeUniqueIndex?.unique !== 1) {
    throw new Error(
      'KAN-885: physical SQLite monthly_charges missing unique athlete-year-month index',
    )
  }

  // Charges must retain their original billing terms until explicit reconciliation.
  const monthlyChargeForeignKeys = sqlite.pragma(
    'foreign_key_list(monthly_charges)',
  ) as Array<{ table: string; from: string; to: string; on_delete: string }>
  const billingTermsForeignKey = monthlyChargeForeignKeys.find(
    foreignKey => foreignKey.from === 'billing_terms_id',
  )
  if (
    billingTermsForeignKey?.table !== 'athlete_billing_terms'
    || billingTermsForeignKey.to !== 'id'
    || billingTermsForeignKey.on_delete.toUpperCase() !== 'RESTRICT'
  ) {
    throw new Error(
      'KAN-885: physical SQLite monthly_charges.billing_terms_id must reference athlete_billing_terms(id) ON DELETE RESTRICT',
    )
  }

  // The original recorder must remain nullable when the user is deleted.
  const recordedByForeignKey = performanceForeignKeys.find(
    foreignKey => foreignKey.from === 'recorded_by_user_id',
  )
  if (
    recordedByForeignKey?.table !== 'users'
    || recordedByForeignKey.to !== 'id'
    || recordedByForeignKey.on_delete.toUpperCase() !== 'SET NULL'
  ) {
    throw new Error(
      'KAN-885: physical SQLite field_performance_tests.recorded_by_user_id must reference users(id) ON DELETE SET NULL',
    )
  }

  // Reuse the established read-only H7A 0020–0025 physical audit rather
  // than reproducing its author, constraint, index and event-table rules.
  const h7aFailures = auditH7aPhysicalSchema(sqlite)
  if (h7aFailures.length > 0) {
    throw new Error('KAN-885: physical SQLite H7A drift: ' + h7aFailures.join('; '))
  }
}
