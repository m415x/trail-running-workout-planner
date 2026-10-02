import { inspectSandboxDestination } from './sandbox-destination'
import { createVerifiedDrizzleMigrationHost } from './drizzle-migration-host'

/**
 * Construct a local-only Drizzle migration host from an injected postgres.js
 * client factory. Construction does not issue queries, BEGIN, or DDL.
 *
 * The returned host exposes the existing guarded transaction interface,
 * never a direct migration command. Its owner must explicitly call end().
 * An operational migration entrypoint is intentionally not provided.
 */
export function createLocalSandboxDrizzleMigrationHost<
  Client extends { end: () => Promise<unknown> },
  Session,
>(request: {
  directUrl?: string
  createClient: (url: string) => Client
  buildDatabase: (client: Client) =>
    Parameters<typeof createVerifiedDrizzleMigrationHost<Session>>[0]
}) {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  let client: Client
  try {
    client = request.createClient(request.directUrl!)
  } catch {
    throw new Error('Sandbox local Drizzle client construction failed')
  }

  let database: Parameters<typeof createVerifiedDrizzleMigrationHost<Session>>[0]
  try {
    database = request.buildDatabase(client)
  } catch {
    // Never surface driver diagnostics, which may contain credentials.
    // The caller owns resources if database construction fails.
    throw new Error('Sandbox local Drizzle database construction failed')
  }

  return {
    database: createVerifiedDrizzleMigrationHost(database),
    end: async () => {
      try {
        await client.end()
      } catch {
        throw new Error('Sandbox local Drizzle client shutdown failed')
      }
    },
  }
}
