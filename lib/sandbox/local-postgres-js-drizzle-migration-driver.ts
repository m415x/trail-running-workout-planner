import { drizzle } from 'drizzle-orm/postgres-js'

import { createInstalledPostgresJsDrizzleMigrationHost } from './drizzle-migration-host'
import { createDefaultLocalSandboxPostgresClient } from './postgres-client'

/**
 * Constructor-only local postgres.js + Drizzle migration driver. It does not
 * read approvals, connect, begin a transaction or apply any SQL by itself.
 * The independent operator approval and canonical transaction preflight must
 * be enforced by the calling migration coordinator before executing DDL.
 *
 * Keep this distinct from the read-only probe driver so that diagnostic code
 * cannot silently acquire a migration entrypoint.
 */
export function createLocalPostgresJsDrizzleMigrationDriver(request: {
  directUrl?: string
}) {
  // The shared local client factory rejects missing/remote URLs before
  // constructing postgres.js. It never falls back to environment variables.
  const client = createDefaultLocalSandboxPostgresClient(request.directUrl)

  try {
    const database = createInstalledPostgresJsDrizzleMigrationHost(drizzle(client))
    return {
      database,
      close: async () => {
        try {
          await client.end()
        } catch {
          throw new Error('Local sandbox PostgreSQL migration driver shutdown failed')
        }
      },
    }
  } catch {
    // No query is issued while constructing the driver. Never expose a
    // postgres.js/Drizzle exception containing a connection string.
    void client.end()
    throw new Error('Local sandbox Drizzle migration driver construction failed')
  }
}
