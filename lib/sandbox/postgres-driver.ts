import { inspectSandboxDestination } from './sandbox-destination'
import { readLocalSandboxSqlIdentity, type LocalSandboxSqlIdentityRow } from './postgres-sql-identity'
import { verifyLocalSandboxPhysicalIdentity } from './postgres-physical-identity'
import { runCoachSandboxOperation } from '../../scripts/coach-sandbox-db'

/**
 * The reserved connection contract follows postgres.js: reserve() pins a
 * session, unsafe() executes SQL on that session, release() returns it to the
 * pool and end() closes the pool. This adapter does not construct a client
 * implicitly or enable any CLI/database operation by itself.
 */
export type ReservedSandboxPostgresConnection = {
  unsafe: (statement: string) => Promise<readonly LocalSandboxSqlIdentityRow[]>
  release: () => void | Promise<void>
}

export type SandboxPostgresClient<Connection extends ReservedSandboxPostgresConnection> = {
  reserve: () => Promise<Connection>
  end: () => Promise<void>
}

export type ReservedSandboxOperationRequest<
  Connection extends ReservedSandboxPostgresConnection,
  Result,
> = {
  directUrl?: string
  operation: string
  expectedClusterSystemIdentifier?: string
  createClient: () => SandboxPostgresClient<Connection>
  execute: (connection: Connection) => Promise<Result>
}

/**
 * Fail closed before constructing a driver. Once constructed, identity and
 * operation must use the identical reserved session, with deterministic
 * release/end on success and failure.
 *
 * A real local PostgreSQL lifecycle, trusted cluster pin provision and
 * migration/seed integration remain separate verification work.
 */
export async function runCoachSandboxWithReservedPostgres<
  Connection extends ReservedSandboxPostgresConnection,
  Result,
>(request: ReservedSandboxOperationRequest<Connection, Result>): Promise<Result> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (!request.expectedClusterSystemIdentifier?.trim()) {
    throw new Error('Trusted sandbox cluster pin required')
  }

  if (request.operation === 'reset') {
    throw new Error('Reset operation is not authorized')
  }

  if (request.operation !== 'migrate' && request.operation !== 'seed') {
    throw new Error('Unsupported sandbox operation')
  }

  let client: SandboxPostgresClient<Connection>
  try {
    client = request.createClient()
  } catch {
    throw new Error('Sandbox PostgreSQL client initialization failed')
  }

  try {
    return await runCoachSandboxOperation({
      directUrl: request.directUrl,
      operation: request.operation,
      open: () => client.reserve(),
      identify: (connection) => verifyLocalSandboxPhysicalIdentity({
        expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
        queryIdentity: () => readLocalSandboxSqlIdentity(
          (statement) => connection.unsafe(statement),
        ),
      }),
      execute: request.execute,
      close: async (connection) => { await connection.release() },
    })
  } finally {
    try {
      await client.end()
    } catch {
      throw new Error('Sandbox PostgreSQL client shutdown failed')
    }
  }
}
