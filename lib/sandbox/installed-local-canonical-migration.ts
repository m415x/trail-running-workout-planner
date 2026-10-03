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
  // This runtime guard is mandatory even when both approval JSON files exist.
  // The caller must secure independent, explicit human DDL permission first.
  authorizeExecution?: () => Promise<boolean>
}): Promise<void> {
  await runIndependentlyApprovedCanonicalMigration({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl,
    readTrustedDocument: request.readTrustedDocument,
    beforeApprovedMigration: async () => {
      let authorized = false
      try {
        authorized = (await request.authorizeExecution?.()) === true
      } catch {
        // A callback error is a denial. Never leak underlying diagnostics.
      }
      if (!authorized) {
        throw new Error('Explicit runtime migration authorization required')
      }
    },
    openDriver: request.openDriver ?? (async () =>
      createLocalPostgresJsDrizzleMigrationDriver({ directUrl: request.directUrl })),
  })
}
