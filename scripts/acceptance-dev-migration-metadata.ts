import type Database from 'better-sqlite3'

import { assertCanonicalAcceptanceMigrationHistory } from '@/scripts/acceptance-dev-migrations'

export interface AcceptanceMigrationMetadataInput {
  sqlite: Database.Database
  projectRoot: string
}

/**
 * KAN-885/T2: read applied migration metadata from an already-open SQLite
 * connection and validate against the checkout's canonical journal and SQL.
 * Never creates or repairs the metadata table and never applies migrations.
 */
export function assertAcceptanceMigrationMetadata({
  sqlite,
  projectRoot,
}: AcceptanceMigrationMetadataInput): void {
  const metadataTable = sqlite.prepare(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = '__drizzle_migrations'",
  ).get()

  if (!metadataTable) {
    throw new Error('KAN-885: SQLite migration metadata table is missing')
  }

  const appliedRows = sqlite.prepare(
    'SELECT hash, created_at FROM __drizzle_migrations',
  ).all() as Array<{ hash: string; created_at: number }>

  assertCanonicalAcceptanceMigrationHistory({ projectRoot, appliedRows })
}
