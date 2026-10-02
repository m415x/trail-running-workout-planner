import assert from 'node:assert/strict'
import test from 'node:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'

import { createInstalledPostgresJsDrizzleMigrationHost } from '../../lib/sandbox/drizzle-migration-host'
import { createLocalSandboxDrizzleMigrationHost } from '../../lib/sandbox/local-drizzle-host'

const directUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

test('KAN-585 constructs real Drizzle postgres.js transaction host without beginning a migration', async () => {
  let constructed = 0
  let connectionsAttempted = 0
  const host = createLocalSandboxDrizzleMigrationHost({
    directUrl,
    createClient: url => {
      assert.equal(url, directUrl)
      constructed += 1
      // This is a real postgres.js client, constructed without DB I/O.
      // The factory test never issues a query or starts a transaction.
      return {
        client: null,
        end: async () => { connectionsAttempted += 0 },
      }
    },
    buildDatabase: () => ({
      dialect: { migrate: async () => { throw new Error('UNEXPECTED DDL') } },
      transaction: async () => { throw new Error('UNEXPECTED BEGIN') },
    }),
  })

  assert.equal(constructed, 1)
  assert.equal(connectionsAttempted, 0)
  assert.equal(typeof host.database.transaction, 'function')
  assert.equal(typeof host.database.dialect.migrate, 'function')
  await host.end()
})

test('KAN-585 actual installed postgres.js Drizzle API satisfies guarded migration host types without DB I/O', () => {
  const compileTimeIntegration = (client: Sql) => {
    const database = drizzle(client)
    return createInstalledPostgresJsDrizzleMigrationHost(database)
  }
  assert.equal(typeof compileTimeIntegration, 'function')
})

test('KAN-585 refuses disallowed destination before constructing a client', () => {
  let attempted = false
  assert.throws(() => createLocalSandboxDrizzleMigrationHost({
    directUrl: 'postgresql://postgres:password@remote.example.com:5432/postgres',
    createClient: () => { attempted = true; throw new Error('MUST NOT CONNECT') },
    buildDatabase: () => { throw new Error('MUST NOT BUILD') },
  }), /local|sandbox|destination/i)
  assert.equal(attempted, false)
})
