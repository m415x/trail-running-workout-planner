import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { PostgresJsSession } from 'drizzle-orm/postgres-js/session'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'

import { createInstalledPostgresJsDrizzleMigrationHost } from '../../lib/sandbox/drizzle-migration-host'

test('KAN-598/C15 installed dialect migration uses savepoint inside existing postgres.js transaction', async () => {
  const statements: string[] = []
  let savepoints = 0

  // An in-memory postgres.js TransactionSql stand-in, deliberately without
  // begin(). No socket, database connection or PostgreSQL DDL is available.
  const transactionClient = {
    unsafe: (statement: string) => {
      statements.push(statement)
      return Object.assign(Promise.resolve([]), {
        values: async () => [],
      })
    },
    savepoint: async <T>(callback: (client: unknown) => Promise<T>): Promise<T> => {
      savepoints += 1
      return callback(transactionClient)
    },
  }

  const dialect = new PgDialect()
  const makeSession = () => new PostgresJsSession(
    transactionClient as unknown as Sql,
    dialect,
    undefined,
  )

  const database = {
    transaction: async (callback: (tx: {
      _: { session: ReturnType<typeof makeSession> }
      transaction: (nested: (tx: { _: { session: ReturnType<typeof makeSession> } }) => Promise<void>) => Promise<void>
    }) => Promise<void>) => {
      await callback({
        _: { session: makeSession() },
        transaction: async nested =>
          transactionClient.savepoint(async () => nested({ _: { session: makeSession() } })),
      })
    },
  }

  const host = createInstalledPostgresJsDrizzleMigrationHost(
    database as unknown as PostgresJsDatabase,
  )

  await host.transaction(async tx => {
    await host.dialect.migrate([{
      sql: ['SELECT 1'],
      hash: 'synthetic-hash',
      folderMillis: 1,
      bps: true,
    }], tx.session, { migrationsFolder: '/synthetic-only' })
  })

  assert.equal(savepoints, 1, 'nested migration must use the existing transaction savepoint')
  assert.ok(statements.some(statement => /CREATE SCHEMA IF NOT EXISTS/i.test(statement)))
  assert.ok(statements.some(statement => /INSERT INTO|insert into/i.test(statement)))
})
