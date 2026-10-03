import { inspectSandboxDestination } from './sandbox-destination'
import {
  authorizeSandboxMutation,
  type PhysicalSandboxIdentity,
  type SandboxMutationOperation,
} from './sandbox-operation-guard'

type VerifiedLocalSandboxRequest<Connection, Result> = {
  directUrl: string
  operation: SandboxMutationOperation
  confirmation?: string
  open: () => Promise<Connection>
  identify: (connection: Connection) => Promise<PhysicalSandboxIdentity>
  execute: (connection: Connection) => Promise<Result>
  close: (connection: Connection) => Promise<void>
}

/**
 * Bind the identity preflight and allowed mutation to one caller-owned
 * connection. This is an adapter contract, not yet a PostgreSQL driver:
 * the T3 implementation must supply the physical identity query and pin
 * execution to the same authenticated session.
 */
export async function withVerifiedLocalSandboxConnection<Connection, Result>(
  request: VerifiedLocalSandboxRequest<Connection, Result>,
): Promise<Result> {
  // Reject any unknown/cloud destination and reset before opening a socket.
  const destination = inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  if (destination.kind !== 'local') {
    throw new Error('Local sandbox endpoint required')
  }

  if (request.operation === 'reset') {
    throw new Error('Reset requires an approved scoped procedure')
  }

  if (request.operation !== 'migrate' && request.operation !== 'seed') {
    throw new Error('Unsupported sandbox operation')
  }

  if (request.confirmation !== request.operation) {
    throw new Error('Sandbox operation-specific confirmation required')
  }

  let connection: Connection
  try {
    connection = await request.open()
  } catch {
    // The connection driver may include credentials in its original message.
    throw new Error('Sandbox connection could not be opened')
  }

  try {
    return await authorizeSandboxMutation({
      destination: { kind: 'local', directUrl: request.directUrl },
      operation: request.operation,
      confirmation: request.confirmation,
      readPhysicalIdentity: () => request.identify(connection),
      execute: () => request.execute(connection),
    })
  } finally {
    try {
      await request.close(connection)
    } catch {
      // Do not propagate raw driver diagnostics (which can include secrets).
      throw new Error('Sandbox connection could not be closed')
    }
  }
}
