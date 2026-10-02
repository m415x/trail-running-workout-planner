import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { loadCanonicalDrizzleMigrationMetadata } from './canonical-drizzle-migrations'
import { verifyCanonicalDrizzleSqlCorrespondence } from './drizzle-sql-correspondence'
import { loadRepositoryCoachSandboxMigrationInventory } from './migration-inventory'

/**
 * Assemble one read-only migration bundle from the existing PostgreSQL Drizzle
 * journal, its complete SQL inventory and Drizzle's installed migrator reader.
 *
 * Validate the inventory first, then compare each raw SQL file byte-for-byte
 * (as UTF-8 text) against the statements and SHA-256 hashes Drizzle will use.
 * No database connection, migration, seed or other write happens here.
 *
 * This verifies internal consistency, not repository provenance or protection
 * against filesystem replacement after reading; those remain caller concerns.
 */
export async function loadVerifiedRepositoryDrizzleMigrationBundle(request: {
  repositoryRoot: string
}) {
  const repositoryRoot = resolve(request.repositoryRoot)
  const migrationsFolder = resolve(repositoryRoot, 'drizzle', 'supabase')

  const inventory = await loadRepositoryCoachSandboxMigrationInventory(repositoryRoot)

  let canonicalSqlInventory: { filename: string; sql: string }[]
  try {
    canonicalSqlInventory = await Promise.all(
      inventory.orderedMigrationFiles.map(async filename => ({
        filename,
        sql: await readFile(resolve(migrationsFolder, filename), 'utf8'),
      })),
    )
  } catch {
    throw new Error('Canonical PostgreSQL migration SQL could not be read')
  }

  const migrations = loadCanonicalDrizzleMigrationMetadata({
    repositoryRoot,
    migrationsFolder,
  })

  if (migrations.length !== inventory.migrationCount) {
    throw new Error('Canonical PostgreSQL migration inventory count mismatch')
  }

  verifyCanonicalDrizzleSqlCorrespondence({
    canonicalSqlInventory,
    migrations,
  })

  return { migrationsFolder, canonicalSqlInventory, migrations }
}
