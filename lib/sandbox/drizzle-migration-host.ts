import type { SQL } from 'drizzle-orm/sql'

import { createDrizzleTransactionIdentityQuery } from './drizzle-identity-query-adapter'

type CanonicalMigration = {
  sql: string[]
  hash: string
  folderMillis: number
  bps: boolean
}

type IdentityRow = {
  database?: string | null
  environmentMarker?: string | null
  clusterSystemIdentifier?: string | null
}

type DrizzleSqlTransaction<Session> = {
  session: Session
  execute: (statement: SQL) => Promise<unknown>
}

type DrizzleMigrationDatabase<Session> = {
  dialect: {
    migrate: (
      migrations: CanonicalMigration[],
      session: Session,
      config: { migrationsFolder: string },
    ) => Promise<void>
  }
  transaction: (
    callback: (transaction: DrizzleSqlTransaction<Session>) => Promise<void>,
  ) => Promise<unknown>
}

/**
 * Bridge the real Drizzle transaction SQL API to our guard's string-query
 * contract without creating another client or changing the session.
 *
 * This adapter does not connect, apply migrations or authorize DDL; the
 * caller must supply the existing transaction host and a separately approved
 * cluster pin. An operational entrypoint remains intentionally absent.
 */
export function createVerifiedDrizzleMigrationHost<Session>(
  database: DrizzleMigrationDatabase<Session>,
) {
  return {
    dialect: database.dialect,
    transaction: (callback: (transaction: {
      session: Session
      execute: (statement: string) => Promise<readonly IdentityRow[]>
    }) => Promise<void>) => database.transaction(async tx => {
      const query = createDrizzleTransactionIdentityQuery({
        execute: statement => tx.execute(statement),
      })
      await callback({
        session: tx.session,
        execute: statement => query(statement) as Promise<readonly IdentityRow[]>,
      })
    }),
  }
}
