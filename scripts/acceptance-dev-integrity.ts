import type Database from 'better-sqlite3'

/**
 * KAN-885/T2: read-only integrity inspection of an already-open SQLite database.
 * The caller is responsible for opening the connection in readonly mode.
 * This function never enables foreign keys, performs repairs, or writes data.
 */
export function assertAcceptanceSqliteIntegrity(sqlite: Database.Database): void {
  const integrityRows = sqlite.pragma('integrity_check') as Array<{ integrity_check: string }>
  if (
    integrityRows.length !== 1
    || integrityRows[0]?.integrity_check !== 'ok'
  ) {
    throw new Error('KAN-885: SQLite integrity_check failed')
  }

  const foreignKeyErrors = sqlite.pragma('foreign_key_check') as unknown[]
  if (foreignKeyErrors.length > 0) {
    throw new Error('KAN-885: SQLite foreign key integrity check failed')
  }
}
