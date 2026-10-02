import postgres from 'postgres'
import { inspectSandboxDestination } from './sandbox-destination'

export type LocalSandboxPostgresOptions = {
  max: number
  prepare: boolean
}

/**
 * Construct a local-only PostgreSQL client without opening a socket.
 * The injected factory keeps authorization independently testable.
 * No implicit environment variable, fallback URL or cloud target is used.
 */
export function createLocalSandboxPostgresClient<Client>(request: {
  directUrl?: string
  postgresFactory: (url: string, options: LocalSandboxPostgresOptions) => Client
}): Client {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  // Inspection guarantees a nonempty URL; do not normalize or replace it.
  const directUrl = request.directUrl!
  try {
    return request.postgresFactory(directUrl, { max: 1, prepare: false })
  } catch {
    // The original driver error could include a password or full DSN.
    throw new Error('Local sandbox PostgreSQL client initialization failed')
  }
}

/**
 * Real postgres.js factory for later explicit local lifecycle integration.
 * Importing this module never constructs a client or performs database I/O.
 */
export function createDefaultLocalSandboxPostgresClient(directUrl?: string) {
  return createLocalSandboxPostgresClient({
    directUrl,
    postgresFactory: (url, options) => postgres(url, options),
  })
}
