import {
  withVerifiedLocalSandboxConnection,
} from '../lib/sandbox/verified-sandbox-connection'
import type { PhysicalSandboxIdentity } from '../lib/sandbox/sandbox-operation-guard'

/**
 * A local-only, callback-injected boundary for sandbox database operations.
 *
 * Deliberately NOT an executable CLI: a concrete PostgreSQL adapter, its
 * physical identity query and a safe migration/seed command will be wired
 * and verified separately. This file performs no database I/O by itself.
 */
export type CoachSandboxOperationRequest<Connection, Result> = {
  operation: string
  directUrl?: string
  open: () => Promise<Connection>
  identify: (connection: Connection) => Promise<PhysicalSandboxIdentity>
  execute: (connection: Connection) => Promise<Result>
  close: (connection: Connection) => Promise<void>
}

export async function runCoachSandboxOperation<Connection, Result>(
  request: CoachSandboxOperationRequest<Connection, Result>,
): Promise<Result> {
  // Never consult a fallback connection string or silently select production.
  if (!request.directUrl) {
    throw new Error('Explicit local sandbox direct URL required')
  }

  if (request.operation === 'reset') {
    throw new Error('Reset operation is not authorized')
  }

  if (request.operation !== 'migrate' && request.operation !== 'seed') {
    throw new Error('Unsupported sandbox operation')
  }

  return withVerifiedLocalSandboxConnection({
    directUrl: request.directUrl,
    operation: request.operation,
    open: request.open,
    identify: request.identify,
    execute: request.execute,
    close: request.close,
  })
}
