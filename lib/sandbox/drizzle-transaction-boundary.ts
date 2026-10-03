import { isAbsolute, win32 } from 'node:path'

import { inspectCoachSandboxApplicationTableCollisions } from './application-table-collisions'
import { inspectSandboxDestination } from './sandbox-destination'
import { inspectCoachSandboxFreshMigrationTarget } from './fresh-migration-target'
import { verifyCanonicalDrizzleSqlCorrespondence } from './drizzle-sql-correspondence'
import { verifyThenSetLocalSandboxSessionMarker } from './local-session-marker'

type CanonicalMigration = {
  sql: string[]
  hash: string
  folderMillis: number
  bps: boolean
}

type TransactionRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
  journal?: string | null
  name?: string
}

type VerifiedDrizzleTransaction<Session> = {
  session: Session
  execute: (statement: string) => Promise<readonly TransactionRow[]>
}

type DrizzleTransactionHost<Session> = {
  dialect: {
    migrate: (
      migrations: CanonicalMigration[],
      session: Session,
      config: { migrationsFolder: string },
    ) => Promise<void>
  }
  transaction: (
    callback: (transaction: VerifiedDrizzleTransaction<Session>) => Promise<void>,
  ) => Promise<unknown>
}

/**
 * Contract boundary only: the host must provide Drizzle's real transaction
 * and canonical dialect migrator. Never create a separate PostgreSQL client
 * between identity verification and migration, or reimplement Drizzle hashes.
 *
 * The transaction's query adapter is injectable for focused TDD. A separate
 * runtime adapter must verify actual Drizzle SQL objects and savepoint
 * behavior before ANY migration is authorized.
 */
export async function runVerifiedCanonicalDrizzleTransaction<Session>(request: {
  directUrl?: string
  expectedClusterSystemIdentifier?: string
  migrationsFolder: string
  canonicalSqlInventory: readonly { filename: string; sql: string }[]
  database: DrizzleTransactionHost<Session>
  loadCanonicalMigrations: (folder: string) => CanonicalMigration[]
}): Promise<void> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!/^[0-9]{1,20}$/.test(request.expectedClusterSystemIdentifier ?? '')) {
    throw new Error('Trusted local sandbox cluster pin required')
  }
  if (
    !request.migrationsFolder
    || !(isAbsolute(request.migrationsFolder) || win32.isAbsolute(request.migrationsFolder))
  ) {
    throw new Error('Canonical sandbox migration folder must be absolute')
  }

  if (!Array.isArray(request.canonicalSqlInventory) || request.canonicalSqlInventory.length === 0) {
    throw new Error('Canonical SQL migration inventory required')
  }

  let migrations: CanonicalMigration[]
  try {
    migrations = request.loadCanonicalMigrations(request.migrationsFolder)
  } catch {
    throw new Error('Canonical Drizzle migration inventory could not be loaded')
  }
  if (
    !Array.isArray(migrations)
    || migrations.length === 0
    || migrations.some(migration => (
      !migration
      || !Array.isArray(migration.sql)
      || migration.sql.some(statement => typeof statement !== 'string')
      || typeof migration.hash !== 'string'
      || migration.hash.length === 0
      || !Number.isFinite(migration.folderMillis)
      || typeof migration.bps !== 'boolean'
    ))
  ) {
    throw new Error('Canonical Drizzle migration inventory invalid')
  }

  verifyCanonicalDrizzleSqlCorrespondence({
    canonicalSqlInventory: request.canonicalSqlInventory,
    migrations,
  })

  await request.database.transaction(async tx => {
    // Every statement and dialect migration shares the transaction session.
    const query = (statement: string) => tx.execute(statement)

    await verifyThenSetLocalSandboxSessionMarker({
      expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
      inExplicitTransaction: true,
      query,
    })

    let markerRows: readonly TransactionRow[]
    try {
      markerRows = await query(
        "SELECT current_setting('app.coach_sandbox_marker', true) AS \"environmentMarker\"",
      )
    } catch {
      throw new Error('Sandbox transaction marker readback failed')
    }
    if (
      !Array.isArray(markerRows)
      || markerRows.length !== 1
      || markerRows[0]?.environmentMarker !== 'trail-running-coach-local-sandbox'
    ) {
      throw new Error('Sandbox transaction marker readback mismatch')
    }

    await inspectCoachSandboxFreshMigrationTarget({ query })
    await inspectCoachSandboxApplicationTableCollisions({
      migrations: request.canonicalSqlInventory,
      query,
    })

    try {
      await request.database.dialect.migrate(
        migrations,
        tx.session,
        { migrationsFolder: request.migrationsFolder },
      )
    } catch {
      // Throw *inside* the transaction callback to force rollback. Never
      // expose driver diagnostics: they can contain SQL and credentials.
      throw new Error('Sandbox canonical Drizzle migration failed')
    }
  })
}
