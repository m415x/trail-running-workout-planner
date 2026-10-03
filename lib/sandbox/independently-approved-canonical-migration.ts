import { readFile } from 'node:fs/promises'

import { runApprovedCanonicalLocalDrizzleMigration } from './approved-canonical-local-drizzle-migration'
import { withIndependentLocalMigrationApproval } from './independent-local-migration-approval'
/**
 * Bridge separately read local pin and migration-intent documents into the
 * existing approved canonical Drizzle driver lifecycle. No connection is
 * created by this module itself; the callback is injected and the canonical
 * migrator remains responsible for live physical and schema preflight.
 *
 * Neither syntactically valid documents nor this wrapper constitute the
 * required separate human authorization to execute real migrations.
 */
export async function runIndependentlyApprovedCanonicalMigration<Database>(request: {
  repositoryRoot: string
  directUrl?: string
  readTrustedDocument?: (path: string) => Promise<string>
  openDriver: () => Promise<{ database: Database; close: () => Promise<unknown> }>
  // Optional pre-execution gate for the installed operational composition.
  // Legacy injected-contract tests remain independent of operator approvals.
  beforeApprovedMigration?: () => Promise<void>
  migrateCanonical?: (input: {
    repositoryRoot: string
    directUrl: string
    expectedClusterSystemIdentifier: string
    database: Database
  }) => Promise<void>
}): Promise<void> {
  const reader = request.readTrustedDocument ?? ((path: string) => readFile(path, 'utf8'))

  await withIndependentLocalMigrationApproval({
    repositoryRoot: request.repositoryRoot,
    directUrl: request.directUrl,
    readTrustedDocument: reader,
    runApprovedMigration: async verified => {
      await request.beforeApprovedMigration?.()
      await runApprovedCanonicalLocalDrizzleMigration({
        repositoryRoot: verified.repositoryRoot,
        directUrl: verified.directUrl,
        approval: verified.approval,
        readTrustedDocument: reader,
        openDriver: request.openDriver,
        migrateCanonical: request.migrateCanonical,
      })
    },
  })
}
