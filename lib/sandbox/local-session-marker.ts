import { readLocalSandboxSqlIdentity } from './postgres-sql-identity'
import { verifyLocalSandboxClusterPin } from './postgres-physical-identity'

type MarkerQueryRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
}

/**
 * First verify the approved physical cluster, then set a transaction-local
 * session marker. The marker is not independent identity evidence.
 *
 * The caller MUST own an actual transaction on this same pinned connection:
 * inExplicitTransaction is an asserted precondition, not proof that the
 * driver opened one. No mutation/transaction CLI is exposed here.
 */
export async function verifyThenSetLocalSandboxSessionMarker(request: {
  expectedClusterSystemIdentifier?: string
  inExplicitTransaction: boolean
  query: (statement: string) => Promise<readonly MarkerQueryRow[]>
}): Promise<{ markerEstablished: true }> {
  if (request.inExplicitTransaction !== true) {
    throw new Error('Explicit sandbox transaction required before session marker')
  }

  await verifyLocalSandboxClusterPin({
    expectedClusterSystemIdentifier: request.expectedClusterSystemIdentifier,
    queryIdentity: () => readLocalSandboxSqlIdentity(request.query),
  })

  let rows: readonly MarkerQueryRow[]
  try {
    rows = await request.query(
      "SELECT set_config('app.coach_sandbox_marker', 'trail-running-coach-local-sandbox', true) AS \"environmentMarker\"",
    )
  } catch {
    // PostgreSQL driver exceptions may include credentials.
    throw new Error('Sandbox transaction-local marker initialization failed')
  }

  if (
    !Array.isArray(rows)
    || rows.length !== 1
    || rows[0]?.environmentMarker !== 'trail-running-coach-local-sandbox'
  ) {
    throw new Error('Sandbox transaction-local marker verification failed')
  }

  return { markerEstablished: true }
}
