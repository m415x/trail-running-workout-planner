import { probeVerifiedLocalDrizzleTransaction } from './local-drizzle-transaction-probe'
import { inspectSandboxDestination } from './sandbox-destination'

type ProbeRow = {
  database?: string | null
  clusterSystemIdentifier?: string | null
  environmentMarker?: string | null
  journal?: string | null
}

type ProbeDatabase = {
  transaction: (callback: (transaction: {
    execute: (statement: string) => Promise<readonly ProbeRow[]>
  }) => Promise<void>) => Promise<unknown>
}

type ProbeDriver = {
  database: ProbeDatabase
  close: () => Promise<unknown>
}

/**
 * Own the connection lifecycle around the local transaction-only probe.
 *
 * The caller supplies a driver factory: neither this function nor its import
 * opens connections implicitly. It validates the destination and independent
 * cluster pin before calling the factory, and always closes an opened driver.
 * No migrator, schema DDL, seed or reset is exposed by this entrypoint.
 */
export async function probeLocalSandboxPostgresJsDrizzle(request: {
  directUrl?: string
  expectedClusterSystemIdentifier?: string
  openDriver: () => Promise<ProbeDriver>
}): Promise<{ verified: true; freshJournal: true }> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!/^[0-9]{1,20}$/.test(request.expectedClusterSystemIdentifier ?? '')) {
    throw new Error('Trusted local sandbox cluster pin required')
  }

  let driver: ProbeDriver
  try {
    driver = await request.openDriver()
  } catch {
    throw new Error('Sandbox local Drizzle probe driver could not be opened')
  }

  let probeError: unknown
  try {
    return await probeVerifiedLocalDrizzleTransaction({
      directUrl: request.directUrl,
      expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
      database: driver.database,
    })
  } catch (error) {
    probeError = error
    throw error
  } finally {
    try {
      await driver.close()
    } catch {
      // Preserve the original failed identity/preflight result if close fails.
      if (probeError === undefined) {
        throw new Error('Sandbox local Drizzle probe driver could not be closed')
      }
    }
  }
}
