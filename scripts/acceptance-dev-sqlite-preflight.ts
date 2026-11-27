import type Database from 'better-sqlite3'
import { assertCanonicalAcceptanceMigrationHistory } from './acceptance-dev-migrations'

export interface AcceptanceSqlitePreflightInput {
  sqlite: Database.Database
  projectRoot: string
}

/**
 * KAN-885/T2: inspect migration metadata on an already-open SQLite connection.
 * The caller owns opening the database read-only and closing it; this helper
 * never performs schema changes, migrations, or writes.
 */
export function assertAcceptanceSqlitePreflight({
  sqlite,
  projectRoot,
}: AcceptanceSqlitePreflightInput): void {
  const migrationTable = sqlite.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  ).get()

  if (!migrationTable) {
    throw new Error('KAN-885: SQLite migration metadata table is missing')
  }

  const appliedRows = sqlite.prepare(
    'SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at',
  ).all() as Array<{ hash: string; created_at: number }>

  assertCanonicalAcceptanceMigrationHistory({ projectRoot, appliedRows })
}
