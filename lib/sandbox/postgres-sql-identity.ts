/**
 * A single read-only PostgreSQL identity query for the *existing* connection.
 * It does not connect on its own, write a marker, or authorize mutations.
 *
 * The caller must run the query on the same connection/session used by the
 * guarded operation and compare the result against an independently trusted
 * cluster pin using verifyLocalSandboxPhysicalIdentity.
 */
export const localSandboxIdentitySql = `
  SELECT
    current_database() AS "database",
    current_setting('app.coach_sandbox_marker', true) AS "environmentMarker",
    (SELECT system_identifier::text FROM pg_control_system()) AS "clusterSystemIdentifier"
`

export type LocalSandboxSqlIdentityRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
}

export async function readLocalSandboxSqlIdentity(
  query: (statement: string) => Promise<readonly LocalSandboxSqlIdentityRow[]>,
): Promise<LocalSandboxSqlIdentityRow> {
  let rows: readonly LocalSandboxSqlIdentityRow[]
  try {
    rows = await query(localSandboxIdentitySql)
  } catch {
    // SQL driver errors can embed credentials or connection strings.
    throw new Error('Sandbox physical identity SQL query failed')
  }

  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]) {
    throw new Error('Sandbox physical identity SQL returned an invalid row count')
  }

  return rows[0]
}
