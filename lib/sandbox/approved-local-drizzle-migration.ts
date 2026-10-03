import { withApprovedLocalMigrationGate } from './approved-local-migration-gate'

type MigrationDriver<Database> = {
  database: Database
  close: () => Promise<unknown>
}

type VerifiedMigrationRequest<Database> = {
  repositoryRoot: string
  directUrl: string
  expectedClusterSystemIdentifier: string
  database: Database
}

/**
 * Compose approval and a single driver lifecycle without executing SQL on its
 * own. The caller-supplied migrator is responsible for the real Drizzle
 * transaction, physical identity, canonical inventory and fresh-target checks.
 * Structural approval does not establish independent operator consent.
 */
export async function runApprovedLocalDrizzleMigration<Database>(request: {
  repositoryRoot: string
  directUrl?: string
  approval?: unknown
  readTrustedDocument?: (path: string) => Promise<string>
  openDriver: () => Promise<MigrationDriver<Database>>
  runMigration: (input: VerifiedMigrationRequest<Database>) => Promise<void>
}): Promise<void> {
  await withApprovedLocalMigrationGate({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl,
    approval: request.approval,
    readTrustedDocument: request.readTrustedDocument,
    runVerifiedMigration: async verified => {
      let driver: MigrationDriver<Database>
      try {
        driver = await request.openDriver()
      } catch {
        throw new Error('Local sandbox Drizzle migration driver could not be opened')
      }

      let failed = false
      try {
        await request.runMigration({
          ...verified,
          database: driver.database,
        })
      } catch {
        failed = true
        throw new Error('Local sandbox Drizzle migration failed')
      } finally {
        try {
          await driver.close()
        } catch {
          if (!failed) {
            throw new Error('Local sandbox Drizzle migration driver could not be closed')
          }
        }
      }
    },
  })
}
