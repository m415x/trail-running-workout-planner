/**
 * Read-only catalog inspection for objects in Drizzle's migration namespace.
 * An absent migration journal is insufficient to certify a fresh namespace.
 * The caller provides the same already-verified transaction query function.
 */
export async function inspectCoachSandboxDrizzleNamespace(request: {
  query: (statement: string) => Promise<unknown>
}): Promise<{ empty: true }> {
  let rows: unknown
  try {
    rows = await request.query(
      "SELECT c.relname AS \"name\" FROM pg_catalog.pg_class AS c JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace WHERE n.nspname = 'drizzle'",
    )
  } catch {
    throw new Error('Sandbox Drizzle namespace catalog inspection failed')
  }

  if (
    !Array.isArray(rows)
    || rows.some(row => (
      !row
      || typeof row !== 'object'
      || Array.isArray(row)
      || !Object.prototype.hasOwnProperty.call(row, 'name')
      || typeof row.name !== 'string'
      || row.name.length === 0
    ))
  ) {
    throw new Error('Sandbox Drizzle namespace catalog response invalid')
  }

  if (rows.length > 0) {
    throw new Error('Sandbox Drizzle namespace contains preexisting objects')
  }

  return { empty: true }
}
