import Database from 'better-sqlite3'

/**
 * KAN-885/T2: open an already-existing physical acceptance SQLite file
 * without permitting database writes or implicit file creation.
 *
 * Path accreditation is a separate, mandatory caller preflight;
 * this function does not discover, migrate, seed or provision fixtures.
 * The caller owns closing the returned connection.
 */
export function openAcceptanceSqliteReadonly(databasePath: string): Database.Database {
  if (!databasePath?.trim()) {
    throw new Error('KAN-885: an existing SQLite database file path is required')
  }

  const sqlite = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  })

  try {
    sqlite.pragma('query_only = ON')
    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
  }
}
