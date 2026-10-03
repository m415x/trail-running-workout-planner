import { inspectCoachSandboxFreshMigrationTarget } from './fresh-migration-target'
import { verifyThenSetLocalSandboxSessionMarker } from './local-session-marker'
import { inspectSandboxDestination } from './sandbox-destination'

type TransactionRow = {
  database?: string | null
  clusterSystemIdentifier?: string | null
  environmentMarker?: string | null
  journal?: string | null
}

type QueryTransaction = {
  execute: (statement: string) => Promise<readonly TransactionRow[]>
}

type ReadOnlyProbeHost = {
  transaction: (callback: (transaction: QueryTransaction) => Promise<void>) => Promise<unknown>
}

/**
 * Inspect the physical PostgreSQL identity, transaction-local marker and
 * absence of Drizzle's migration journal within one driver-owned transaction.
 *
 * This probe never invokes a migrator or executes schema DDL. A successful
 * probe is not authorization to apply migrations or otherwise mutate a DB.
 */
export async function probeVerifiedLocalDrizzleTransaction(request: {
  directUrl?: string
  expectedClusterSystemIdentifier?: string
  database: ReadOnlyProbeHost
}): Promise<{ verified: true; freshJournal: true }> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!/^[0-9]{1,20}$/.test(request.expectedClusterSystemIdentifier ?? '')) {
    throw new Error('Trusted local sandbox cluster pin required')
  }

  await request.database.transaction(async tx => {
    const query = (statement: string) => tx.execute(statement)

    await verifyThenSetLocalSandboxSessionMarker({
      expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
      inExplicitTransaction: true,
      query,
    })

    let rows: readonly TransactionRow[]
    try {
      rows = await query(
        "SELECT current_setting('app.coach_sandbox_marker', true) AS \"environmentMarker\"",
      )
    } catch {
      throw new Error('Sandbox transaction marker readback failed')
    }

    if (
      !Array.isArray(rows)
      || rows.length !== 1
      || rows[0]?.environmentMarker !== 'trail-running-coach-local-sandbox'
    ) {
      throw new Error('Sandbox transaction marker readback mismatch')
    }

    await inspectCoachSandboxFreshMigrationTarget({ query })
  })

  return { verified: true, freshJournal: true }
}
