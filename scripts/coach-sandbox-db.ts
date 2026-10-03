import {
  withVerifiedLocalSandboxConnection,
} from '../lib/sandbox/verified-sandbox-connection'
import type { PhysicalSandboxIdentity } from '../lib/sandbox/sandbox-operation-guard'
import { verifyLocalSandboxPhysicalIdentity } from '../lib/sandbox/postgres-physical-identity'
import { readLocalSandboxSqlIdentity, type LocalSandboxSqlIdentityRow } from '../lib/sandbox/postgres-sql-identity'

/**
 * A local-only, callback-injected boundary for sandbox database operations.
 *
 * Deliberately NOT an executable CLI: a concrete PostgreSQL adapter, its
 * physical identity query and a safe migration/seed command will be wired
 * and verified separately. This file performs no database I/O by itself.
 */
export type CoachSandboxOperationRequest<Connection, Result> = {
  operation: string
  confirmation?: string
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

  if (request.confirmation !== request.operation) {
    throw new Error('Sandbox operation-specific confirmation required')
  }

  return withVerifiedLocalSandboxConnection({
    directUrl: request.directUrl,
    operation: request.operation,
    confirmation: request.confirmation,
    open: request.open,
    identify: request.identify,
    execute: request.execute,
    close: request.close,
  })
}

/**
 * T2 adapter: all preflight SQL and the caller's operation share one connection.
 *
 * This does not provision a cluster, discover a trusted pin, or expose a CLI
 * that executes a migration. T3 must supply a reviewed concrete SQL adapter.
 */
export type PinnedCoachSandboxConnection = {
  query: (statement: string) => Promise<readonly LocalSandboxSqlIdentityRow[]>
}

export type PinnedCoachSandboxRequest<Connection extends PinnedCoachSandboxConnection, Result> = {
  directUrl?: string
  operation: string
  expectedClusterSystemIdentifier?: string
  open: () => Promise<Connection>
  execute: (connection: Connection) => Promise<Result>
  close: (connection: Connection) => Promise<void>
}

export async function runPinnedCoachSandboxOperation<
  Connection extends PinnedCoachSandboxConnection,
  Result,
>(request: PinnedCoachSandboxRequest<Connection, Result>): Promise<Result> {
  if (!request.expectedClusterSystemIdentifier?.trim()) {
    throw new Error('Trusted sandbox cluster pin is required')
  }

  return runCoachSandboxOperation({
    directUrl: request.directUrl,
    operation: request.operation,
    confirmation: request.confirmation,
    open: request.open,
    identify: (connection) => verifyLocalSandboxPhysicalIdentity({
      expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
      queryIdentity: () => readLocalSandboxSqlIdentity((statement) => connection.query(statement)),
    }),
    execute: request.execute,
    close: request.close,
  })
}
