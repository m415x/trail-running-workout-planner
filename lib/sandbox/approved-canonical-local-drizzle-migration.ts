import { runApprovedLocalDrizzleMigration } from './approved-local-drizzle-migration'
import { runVerifiedRepositoryDrizzleMigrationTransaction } from './verified-drizzle-migration-runner'

type CanonicalHost = Parameters<typeof runVerifiedRepositoryDrizzleMigrationTransaction>[0]['database']

type CanonicalInput<Database> = {
  repositoryRoot: string
  directUrl: string
  expectedClusterSystemIdentifier: string
  database: Database
}

/**
 * Reuse the existing approval, driver lifecycle and canonical Drizzle runner.
 * A provided migrator is a test seam only; the default calls the repository
 * migrator, which verifies source inventory and physical transaction identity.
 *
 * No driver is created on import and this function is not an executable CLI.
 * Structural approval is not independent operator consent for database writes.
 */
export async function runApprovedCanonicalLocalDrizzleMigration<Database>(request: {
  repositoryRoot: string
  directUrl?: string
  approval?: unknown
  readTrustedDocument?: (path: string) => Promise<string>
  openDriver: () => Promise<{ database: Database; close: () => Promise<unknown> }>
  migrateCanonical?: (input: CanonicalInput<Database>) => Promise<void>
}): Promise<void> {
  return runApprovedLocalDrizzleMigration({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl,
    approval: request.approval,
    readTrustedDocument: request.readTrustedDocument,
    openDriver: request.openDriver,
    runMigration: async input => {
      if (request.migrateCanonical) {
        await request.migrateCanonical(input)
        return
      }

      await runVerifiedRepositoryDrizzleMigrationTransaction({
        repositoryRoot: input.repositoryRoot,
        directUrl: input.directUrl,
        expectedClusterSystemIdentifier: input.expectedClusterSystemIdentifier,
        database: input.database as CanonicalHost,
      })
    },
  })
}
