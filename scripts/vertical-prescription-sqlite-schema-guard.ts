import type Database from 'better-sqlite3'

/**
 * Audits the physical SQLite shape required by vertical group prescriptions.
 * This is read-only and safe for disposable HEAD-schema verification.
 */
export function auditVerticalPrescriptionSqliteSchema(sqlite: Database.Database): string[] {
  const failures: string[] = []
  const columns = sqlite.pragma('table_info(group_session_prescriptions)') as Array<{
    name: string
    type: string
    notnull: number
  }>

  for (const name of ['primary_objective', 'vertical_block_json']) {
    const column = columns.find((item) => item.name === name)
    if (!column || column.type.toUpperCase() !== 'TEXT' || column.notnull !== 0) {
      failures.push(`group_session_prescriptions.${name} must be nullable TEXT`)
    }
  }

  return failures
}
