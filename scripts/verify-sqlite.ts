import Database from 'better-sqlite3'

const sqlite = new Database('sqlite.db', { fileMustExist: true })
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

  const foreignKeyErrors = sqlite.pragma('foreign_key_check') as unknown[]
  if (foreignKeyErrors.length > 0) throw new Error('SQLite foreign key integrity check failed')

  console.log('SQLite schema verification passed')
} finally {
  sqlite.close()
}
