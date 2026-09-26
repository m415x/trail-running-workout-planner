import Database from 'better-sqlite3'

const sqlite = new Database(process.env.SQLITE_SCENARIO_MODE === '1' ? (process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required for SQLite scenario verification') })()) : 'sqlite.db', { fileMustExist: true })
try {
  const requiredTables = [
    'users',
    'athlete_profiles',
    'field_performance_tests',
    'team_economic_policies',
    'athlete_billing_terms',
    'monthly_charges',
  ]
  const tables = new Set(
    (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[])
      .map(row => row.name),
  )

  for (const table of requiredTables) {
    if (!tables.has(table)) throw new Error(`SQLite schema is not at HEAD: missing table ${table}`)
  }

  const fieldPerformanceColumns = new Set(
    (sqlite.prepare('PRAGMA table_info(field_performance_tests)').all() as { name: string }[])
      .map(row => row.name),
  )
  if (!fieldPerformanceColumns.has('recorded_by_user_id')) {
    throw new Error(
      'SQLite schema is inconsistent: field_performance_tests.recorded_by_user_id is missing',
    )
  }

  if (!tables.has('microcycle_intensity_targets')) {
    throw new Error('SQLite schema is not at HEAD: missing table microcycle_intensity_targets')
  }

  const intensityTargetColumns = new Set(
    (sqlite.prepare('PRAGMA table_info(microcycle_intensity_targets)').all() as { name: string }[])
      .map(row => row.name),
  )
  if (!intensityTargetColumns.has('reference_percentage_target')) {
    throw new Error(
      'SQLite schema is not at HEAD: microcycle_intensity_targets.reference_percentage_target is missing',
    )
  }
  if (intensityTargetColumns.has('pam_percentage_target')) {
    throw new Error(
      'SQLite schema is not at HEAD: legacy microcycle_intensity_targets.pam_percentage_target remains',
    )
  }

  const recordedByUserForeignKey = (sqlite.pragma('foreign_key_list(field_performance_tests)') as Array<{
    table: string
    from: string
    to: string
    on_delete: string
  }>).find(foreignKey => foreignKey.from === 'recorded_by_user_id')
  if (
    recordedByUserForeignKey?.table !== 'users'
    || recordedByUserForeignKey.to !== 'id'
    || recordedByUserForeignKey.on_delete !== 'SET NULL'
  ) {
    throw new Error(
      'SQLite schema is inconsistent: field_performance_tests.recorded_by_user_id must reference users(id) ON DELETE SET NULL',
    )
  }

  const monthlyChargeIndexes = sqlite.pragma('index_list(monthly_charges)') as Array<{
    name: string
    unique: number
  }>
  const monthlyChargeUniqueIndex = monthlyChargeIndexes.find(
    index => index.name === 'monthly_charges_athlete_year_month_unique',
  )
  if (monthlyChargeUniqueIndex?.unique !== 1) {
    throw new Error(
      'SQLite schema is inconsistent: monthly_charges must enforce one charge per athlete calendar month',
    )
  }

  const monthlyChargeForeignKeys = sqlite.pragma('foreign_key_list(monthly_charges)') as Array<{
    table: string
    from: string
    to: string
    on_delete: string
  }>
  const billingTermsForeignKey = monthlyChargeForeignKeys.find(
    foreignKey => foreignKey.from === 'billing_terms_id',
  )
  if (
    billingTermsForeignKey?.table !== 'athlete_billing_terms'
    || billingTermsForeignKey.to !== 'id'
    || billingTermsForeignKey.on_delete !== 'RESTRICT'
  ) {
    throw new Error(
      'SQLite schema is inconsistent: monthly_charges.billing_terms_id must reference athlete_billing_terms(id) ON DELETE RESTRICT',
    )
  }

  const foreignKeyErrors = sqlite.pragma('foreign_key_check') as unknown[]
  if (foreignKeyErrors.length > 0) throw new Error('SQLite foreign key integrity check failed')

  console.log('SQLite schema verification passed')
} finally {
  sqlite.close()
}
