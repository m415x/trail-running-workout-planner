import { inspectSandboxDestination } from './sandbox-destination'
import { loadApprovedLocalSandboxPinFile } from './local-pin-file'
import { readLocalSandboxSqlIdentity, type LocalSandboxSqlIdentityRow } from './postgres-sql-identity'
import { verifyLocalSandboxClusterPin, verifyLocalSandboxPhysicalIdentity } from './postgres-physical-identity'

type ReadOnlyConnection = {
  unsafe: (statement: string) => Promise<readonly LocalSandboxSqlIdentityRow[]>
  release: () => Promise<void> | void
}

type ReadOnlyClient<Connection extends ReadOnlyConnection> = {
  reserve: () => Promise<Connection>
  end: () => Promise<void>
}

type ReadOnlyIdentityRequest<Connection extends ReadOnlyConnection> = {
  repositoryRoot: string
  directUrl?: string
  /** An approved local file is the default source; tests may inject a reader. */
  loadApprovedPin?: () => Promise<string>
  /** Caller owns driver construction; no fallback PostgreSQL connection is used. */
  createClient: () => ReadOnlyClient<Connection>
}

/**
 * Read-only physical identity preflight. Validates the destination first,
 * loads an operator-approved pin, reserves one session and issues only the
 * identity SELECT. It cannot migrate, seed, reset or authorize future writes.
 */
async function checkReadOnlyPreflight<Connection extends ReadOnlyConnection>(
  request: ReadOnlyIdentityRequest<Connection>,
  mode: 'physical-cluster' | 'marker-required',
): Promise<{ verified: true }> {
  inspectSandboxDestination({ kind: 'local', directUrl: request.directUrl })

  let approvedPin: string
  try {
    approvedPin = await (request.loadApprovedPin
      ? request.loadApprovedPin()
      : loadApprovedLocalSandboxPinFile({ repositoryRoot: request.repositoryRoot }))
  } catch {
    throw new Error('Trusted local sandbox cluster pin unavailable')
  }
  if (!/^[0-9]{1,20}$/.test(approvedPin)) {
    throw new Error('Trusted local sandbox cluster pin invalid')
  }

  let client: ReadOnlyClient<Connection>
  try {
    client = request.createClient()
  } catch {
    throw new Error('Sandbox read-only PostgreSQL client initialization failed')
  }

  let connection: Connection | undefined
  try {
    try {
      connection = await client.reserve()
    } catch {
      throw new Error('Sandbox read-only PostgreSQL session failed')
    }

    const verification = {
      expectedClusterSystemIdentifier: approvedPin,
      queryIdentity: () => readLocalSandboxSqlIdentity(
        statement => connection!.unsafe(statement),
      ),
    }
    if (mode === 'physical-cluster') {
      await verifyLocalSandboxClusterPin(verification)
    } else {
      await verifyLocalSandboxPhysicalIdentity(verification)
    }
    return { verified: true }
  } finally {
    try {
      if (connection) await connection.release()
    } catch {
      throw new Error('Sandbox read-only PostgreSQL session release failed')
    } finally {
      try {
        await client.end()
      } catch {
        throw new Error('Sandbox read-only PostgreSQL client shutdown failed')
      }
    }
  }
}

/**
 * First-stage read-only preflight: the operator-approved physical cluster is
 * verified without relying on any caller-controlled session marker.
 * This does not authorize any database writes.
 */
export async function checkLocalSandboxReadOnlyCluster<
  Connection extends ReadOnlyConnection,
>(request: ReadOnlyIdentityRequest<Connection>): Promise<{ verified: true }> {
  return checkReadOnlyPreflight(request, 'physical-cluster')
}

/**
 * Stricter read-only compatibility probe requiring the legacy session marker.
 * Retained independently so mutation guards are never relaxed implicitly.
 */
export async function checkLocalSandboxReadOnlyIdentity<
  Connection extends ReadOnlyConnection,
>(request: ReadOnlyIdentityRequest<Connection>): Promise<{ verified: true }> {
  return checkReadOnlyPreflight(request, 'marker-required')
}
