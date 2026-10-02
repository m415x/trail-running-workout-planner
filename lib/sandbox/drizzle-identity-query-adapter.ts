import { sql, type SQL } from 'drizzle-orm/sql'

/**
 * Adapter for identity queries executed on Drizzle's existing transaction.
 * Drizzle tx.execute expects an SQL object, not a SQL string.
 *
 * The input SQL must be authored by our trusted sandbox guards; it is not an
 * entrypoint for operator-supplied or dynamically constructed statements.
 * Raw driver errors are intentionally replaced to avoid leaking credentials.
 */
export function createDrizzleTransactionIdentityQuery(request: {
  execute: (statement: SQL) => Promise<unknown>
}): (statement: string) => Promise<readonly Record<string, unknown>[]> {
  return async statement => {
    if (typeof statement !== 'string' || !/^\s*SELECT\b/i.test(statement)) {
      throw new Error('Sandbox Drizzle identity query must be a SELECT')
    }

    let result: unknown
    try {
      result = await request.execute(sql.raw(statement))
    } catch {
      throw new Error('Sandbox Drizzle identity query failed')
    }

    if (
      !Array.isArray(result)
      || result.some(row => !row || typeof row !== 'object' || Array.isArray(row))
    ) {
      throw new Error('Sandbox Drizzle identity query returned invalid rows')
    }

    return result as Record<string, unknown>[]
  }
}
