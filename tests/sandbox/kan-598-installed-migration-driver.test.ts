import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalPostgresJsDrizzleMigrationDriver } from '../../lib/sandbox/local-postgres-js-drizzle-migration-driver'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

test('KAN-598/C09 constructs installed local migration host without executing SQL', async () => {
  const driver = createLocalPostgresJsDrizzleMigrationDriver({ directUrl: localUrl })
  try {
    assert.equal(typeof driver.database.transaction, 'function')
    assert.equal(typeof driver.database.dialect.migrate, 'function')
    // Constructor only: never call transaction or migrate in this test.
  } finally {
    await driver.close()
  }
})

test('KAN-598/C09 rejects remote migration destination before PostgreSQL client creation', () => {
  assert.throws(() => createLocalPostgresJsDrizzleMigrationDriver({
    directUrl: 'postgresql://postgres:password@db.example.org:5432/postgres',
  }), /sandbox|local|endpoint/i)
})

test('KAN-598/C09 rejects missing endpoint rather than falling back to environment URL', () => {
  assert.throws(() => createLocalPostgresJsDrizzleMigrationDriver({}), /sandbox|local|URL|explicit/i)
})
