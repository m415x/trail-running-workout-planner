import { drizzle } from 'drizzle-orm/postgres-js'

import { createInstalledPostgresJsDrizzleMigrationHost } from './drizzle-migration-host'
import { createDefaultLocalSandboxPostgresClient } from './postgres-client'

/**
 * Construct the installed postgres.js + Drizzle adapter for the read-only
 * local sandbox probe. postgres.js opens a socket only when a query runs:
 * this constructor never runs a query or starts a transaction.
 *
 * Caller owns the lifecycle and MUST close the client. This module exposes
 * no executable migration command, seed or reset operation.
 */
export function createLocalPostgresJsDrizzleProbeDriver(request: {
  directUrl?: string
}) {
  // Destination validation happens inside the client factory, before the
  // postgres.js client is constructed. No environment-based URL fallback.
  const client = createDefaultLocalSandboxPostgresClient(request.directUrl)

  try {
    const database = drizzle(client)
    const host = createInstalledPostgresJsDrizzleMigrationHost(database)
    return {
      database: host,
      close: async () => {
        try {
          await client.end()
        } catch {
          throw new Error('Local sandbox PostgreSQL probe client shutdown failed')
        }
      },
    }
  } catch {
    // No socket or query has been opened by constructor-only operations.
    // Avoid leaking connection strings in errors.
    void client.end()
    throw new Error('Local sandbox Drizzle probe driver construction failed')
  }
}
