type DrizzleJournalRow = {
  journal?: string | null
}

/**
 * Read-only preflight for a fresh application migration target. Supabase may
 * have its own managed schemas; absence of the Drizzle journal is necessary,
 * but never sufficient, proof that an application migration is safe.
 *
 * The caller supplies an already verified, pinned PostgreSQL session.
 * No connection, DDL, mutation, migration, or fallback is performed here.
 */
export async function inspectCoachSandboxFreshMigrationTarget(request: {
  query: (statement: string) => Promise<readonly DrizzleJournalRow[]>
}): Promise<{ fresh: true }> {
  let rows: readonly DrizzleJournalRow[]
  try {
    rows = await request.query(
      "SELECT to_regclass('drizzle.__drizzle_migrations')::text AS \"journal\"",
    )
  } catch {
    // Driver exceptions may include credentials or a connection string.
    throw new Error('Sandbox Drizzle migration journal inspection failed')
  }

  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.journal !== null) {
    throw new Error('Sandbox fresh migration target requires an absent Drizzle journal')
  }

  return { fresh: true }
}
