type CanonicalMigrationSql = {
  filename: string
  sql: string
}

const createTableToken = /\bCREATE\s+TABLE\b/gi
const supportedCreateTable = /^CREATE\s+TABLE\s+"([a-z_][a-z0-9_]*)"\s*\(/i

/**
 * Inspect only the checked-in Drizzle SQL supplied by the caller. Every
 * CREATE TABLE must use Drizzle's unqualified, quoted public-table syntax;
 * unfamiliar syntax fails closed rather than silently undercounting tables.
 * This is not a general SQL parser or proof of a conflict-free schema.
 */
export function extractCoachSandboxCreatedTables(
  migrations: readonly CanonicalMigrationSql[],
): string[] {
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error('Canonical sandbox migration inventory is required')
  }

  const names = new Set<string>()

  for (const migration of migrations) {
    if (
      !migration
      || typeof migration.filename !== 'string'
      || !/^\d{4}_[a-z0-9_]+\.sql$/.test(migration.filename)
      || typeof migration.sql !== 'string'
      || migration.sql.trim().length === 0
    ) {
      throw new Error('Invalid canonical sandbox migration SQL')
    }

    for (const token of migration.sql.matchAll(createTableToken)) {
      const remainder = migration.sql.slice(token.index)
      const statement = supportedCreateTable.exec(remainder)
      if (!statement) {
        throw new Error('Unsupported CREATE TABLE in sandbox migration inventory')
      }
      names.add(statement[1])
    }
  }

  if (names.size === 0) {
    throw new Error('Canonical sandbox migrations contain no application tables')
  }

  return [...names].sort()
}

/**
 * One read-only catalog query obtains public relations including non-table
 * objects that could occupy an application table name. Never interpolate
 * migration input into SQL. Fail on malformed catalog rows or collisions.
 */
export async function inspectCoachSandboxApplicationTableCollisions(request: {
  migrations: readonly CanonicalMigrationSql[]
  query: (statement: string) => Promise<unknown>
}): Promise<{ noCollisions: true; checkedTables: number }> {
  const names = extractCoachSandboxCreatedTables(request.migrations)
  let rows: unknown

  try {
    rows = await request.query(`
      SELECT c.relname AS "name"
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
    `)
  } catch {
    throw new Error('Sandbox application table catalog inspection failed')
  }

  if (
    !Array.isArray(rows)
    || rows.some(row => (
      !row
      || typeof row !== 'object'
      || Array.isArray(row)
      || typeof row.name !== 'string'
    ))
  ) {
    throw new Error('Malformed sandbox application table catalog inventory')
  }

  const expected = new Set(names)
  if (rows.some(row => expected.has(row.name))) {
    throw new Error('Sandbox application table name collision detected')
  }

  return { noCollisions: true, checkedTables: names.length }
}
