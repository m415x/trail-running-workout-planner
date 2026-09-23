import Database from 'better-sqlite3'

const sqlite = new Database(process.env.SQLITE_SCENARIO_MODE === '1' ? (process.env.SQLITE_DATABASE_PATH ?? (() => { throw new Error('SQLITE_DATABASE_PATH is required for SQLite scenario verification') })()) : 'sqlite.db', { fileMustExist: true })
try {
  const requiredTables = ['users', 'athlete_profiles', 'field_performance_tests']
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

  const foreignKeyErrors = sqlite.pragma('foreign_key_check') as unknown[]
  if (foreignKeyErrors.length > 0) throw new Error('SQLite foreign key integrity check failed')

  console.log('SQLite schema verification passed')
} finally {
  sqlite.close()
}
