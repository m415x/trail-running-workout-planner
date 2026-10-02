import type { PhysicalSandboxIdentity } from './sandbox-operation-guard'

type PostgreSqlIdentityRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
}

export type LocalSandboxPhysicalIdentityRequest = {
  /** Pin obtained independently from the explicitly approved local cluster. */
  expectedClusterSystemIdentifier?: string
  /** Read identity from the connection later used for the guarded mutation. */
  queryIdentity: () => Promise<PostgreSqlIdentityRow>
}

/**
 * Verify supplied PostgreSQL identity evidence against an independently
 * trusted cluster pin. This function never initiates a database connection:
 * T3 must wire queryIdentity to a real, pinned PostgreSQL session.
 *
 * A database-local marker is not sufficient: it can be copied to a different
 * cluster. The cluster identifier must not be learned from this same query.
 */
export async function verifyLocalSandboxPhysicalIdentity(
  request: LocalSandboxPhysicalIdentityRequest,
): Promise<PhysicalSandboxIdentity> {
  const pin = request.expectedClusterSystemIdentifier

  if (typeof pin !== 'string' || pin.trim() === '') {
    throw new Error('Trusted physical cluster pin is required for sandbox identity')
  }

  let row: PostgreSqlIdentityRow
  try {
    row = await request.queryIdentity()
  } catch {
    // SQL drivers can include credential-bearing URLs in their errors.
    throw new Error('PostgreSQL sandbox physical identity query failed')
  }

  if (
    !row
    || row.database !== 'postgres'
    || row.environmentMarker !== 'trail-running-coach-local-sandbox'
    || typeof row.clusterSystemIdentifier !== 'string'
    || row.clusterSystemIdentifier.length === 0
    || row.clusterSystemIdentifier !== pin
  ) {
    throw new Error('PostgreSQL sandbox physical identity or cluster mismatch')
  }

  return {
    database: 'postgres',
    environmentMarker: 'trail-running-coach-local-sandbox',
    projectRef: null,
  }
}
