import { inspectSandboxDestination } from './sandbox-destination'
import { runVerifiedCanonicalDrizzleTransaction } from './drizzle-transaction-boundary'
import { loadVerifiedRepositoryDrizzleMigrationBundle } from './verified-drizzle-migration-bundle'

type CanonicalMigration = {
  sql: string[]
  hash: string
  folderMillis: number
  bps: boolean
}

type SandboxRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
  journal?: string | null
  name?: string
}

type VerifiedTransaction<Session> = {
  session: Session
  execute: (statement: string) => Promise<readonly SandboxRow[]>
}

type MigrationHost<Session> = {
  dialect: {
    migrate: (
      migrations: CanonicalMigration[],
      session: Session,
      config: { migrationsFolder: string },
    ) => Promise<void>
  }
  transaction: (
    callback: (transaction: VerifiedTransaction<Session>) => Promise<void>,
  ) => Promise<unknown>
}

/**
 * Compose the repository's canonical Drizzle migration bundle with the
 * guarded transaction. The caller cannot substitute an independent SQL
 * inventory, journal or migration reader through this entrypoint.
 *
 * This is deliberately dependency-injected: it neither creates a connection
 * nor constitutes an operator-facing migration command. Runtime driver
 * compatibility and filesystem provenance remain separate approval gates.
 */
export async function runVerifiedRepositoryDrizzleMigrationTransaction<Session>(request: {
  repositoryRoot: string
  directUrl?: string
  expectedClusterSystemIdentifier?: string
  database: MigrationHost<Session>
}): Promise<void> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!/^[0-9]{1,20}$/.test(request.expectedClusterSystemIdentifier ?? '')) {
    throw new Error('Trusted local sandbox cluster pin required')
  }

  const bundle = await loadVerifiedRepositoryDrizzleMigrationBundle({
    repositoryRoot: request.repositoryRoot,
  })

  await runVerifiedCanonicalDrizzleTransaction({
    directUrl: request.directUrl,
    expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
    migrationsFolder: bundle.migrationsFolder,
    canonicalSqlInventory: bundle.canonicalSqlInventory,
    loadCanonicalMigrations: () => bundle.migrations,
    database: request.database,
  })
}
