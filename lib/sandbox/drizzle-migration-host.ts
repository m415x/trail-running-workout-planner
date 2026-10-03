import { PgDatabase, PgDialect } from 'drizzle-orm/pg-core'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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

/**
 * Explicitly typed bridge for the actual installed postgres.js Drizzle API.
 * This keeps PgDialect.migrate's PgSession parameter intact rather than
 * widening it to unknown (which breaks function-parameter variance).
 * No connection, transaction or migration is started by this factory.
 */
export function createInstalledPostgresJsDrizzleMigrationHost(
  database: PostgresJsDatabase,
) {
  const dialect = new PgDialect()
  // Matches the installed Drizzle PgDatabase constructor's actual session
  // contract, used by the official postgres.js migrator.
  type Session = ConstructorParameters<typeof PgDatabase>[1]
  return {
    dialect: {
      migrate: async (
        migrations: CanonicalMigration[],
        session: Session,
        config: { migrationsFolder: string },
      ) => dialect.migrate(migrations, session, config),
    },
    transaction: (callback: (transaction: {
      session: Session
      execute: (statement: string) => Promise<readonly IdentityRow[]>
    }) => Promise<void>) => database.transaction(async tx => {
      const query = createDrizzleTransactionIdentityQuery({
        execute: statement => tx.execute(statement),
      })

      // PgDialect.migrate calls session.transaction() for its inner migration
      // loop. tx._.session belongs to postgres.js TransactionSql, whose
      // client supports savepoint(), not begin(). Delegate nested transactions
      // through Drizzle's transaction object so the same outer connection
      // and its savepoint semantics are preserved.
      const migrationSession = new Proxy(tx._.session, {
        get(target, property, receiver) {
          if (property === 'transaction') {
            return tx.transaction.bind(tx)
          }
          return Reflect.get(target, property, receiver)
        },
      })

      await callback({
        session: migrationSession,
        execute: statement => query(statement) as Promise<readonly IdentityRow[]>,
      })
    }),
  }
}
