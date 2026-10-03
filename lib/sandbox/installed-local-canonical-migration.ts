import { runIndependentlyApprovedCanonicalMigration } from './independently-approved-canonical-migration'
import { createLocalPostgresJsDrizzleMigrationDriver } from './local-postgres-js-drizzle-migration-driver'

type InstalledMigrationDriver = ReturnType<typeof createLocalPostgresJsDrizzleMigrationDriver>

/**
 * Wire the independently checked local documents to the installed Drizzle
 * migration driver and the existing canonical transaction runner.
 *
 * This is a library composition point, NOT a CLI or an operational grant:
 * callers must still obtain separate explicit human authorization before
 * invoking anything that could apply DDL. Neither JSON file proves consent.
 * Importing this module never creates a connection or executes SQL.
 */
export async function runInstalledLocalCanonicalMigration(request: {
  repositoryRoot: string
  directUrl?: string
  readTrustedDocument?: (path: string) => Promise<string>
  openDriver?: () => Promise<InstalledMigrationDriver>
}): Promise<void> {
  await runIndependentlyApprovedCanonicalMigration({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl,
    readTrustedDocument: request.readTrustedDocument,
    openDriver: request.openDriver ?? (async () =>
      createLocalPostgresJsDrizzleMigrationDriver({ directUrl: request.directUrl })),
  })
}
