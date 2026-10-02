import { inspectSandboxDestination } from './sandbox-destination'
import { verifyThenSetLocalSandboxSessionMarker } from './local-session-marker'

type MarkerRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
}

type SandboxTransaction = {
  unsafe: (statement: string) => Promise<readonly MarkerRow[]>
}

type TransactionClient = {
  begin: (callback: (transaction: SandboxTransaction) => Promise<unknown>) => Promise<unknown>
  end: () => Promise<void>
}

/**
 * The driver owns BEGIN/COMMIT/ROLLBACK. Physical identity, the transaction-
 * local marker and its readback all use the same transaction connection.
 * This read-only verification entrypoint has no migration or seed callback.
 *
 * The caller must supply a pin from an independently approved source.
 * Tests inject the driver; a live postgres.js adapter remains to be verified.
 */
export async function verifyLocalSandboxMarkerInTransaction(request: {
  directUrl?: string
  expectedClusterSystemIdentifier?: string
  createClient: () => TransactionClient
}): Promise<{ verified: true }> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!/^[0-9]{1,20}$/.test(request.expectedClusterSystemIdentifier ?? '')) {
    throw new Error('Trusted sandbox cluster pin required')
  }

  let client: TransactionClient
  try {
    client = request.createClient()
  } catch {
    throw new Error('Sandbox PostgreSQL transaction client initialization failed')
  }

  try {
    await client.begin(async transaction => {
      await verifyThenSetLocalSandboxSessionMarker({
        expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
        inExplicitTransaction: true,
        query: statement => transaction.unsafe(statement),
      })

      let markerRows: readonly MarkerRow[]
      try {
        markerRows = await transaction.unsafe(
          "SELECT current_setting('app.coach_sandbox_marker', true) AS \"environmentMarker\"",
        )
      } catch {
        throw new Error('Sandbox transaction-local marker readback failed')
      }

      if (
        markerRows.length !== 1
        || markerRows[0]?.environmentMarker !== 'trail-running-coach-local-sandbox'
      ) {
        throw new Error('Sandbox transaction-local marker readback mismatch')
      }
    })

    return { verified: true }
  } finally {
    try {
      await client.end()
    } catch {
      throw new Error('Sandbox PostgreSQL transaction client shutdown failed')
    }
  }
}
