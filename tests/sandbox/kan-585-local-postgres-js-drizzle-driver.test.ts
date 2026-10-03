import assert from 'node:assert/strict'
import test from 'node:test'

import { createLocalPostgresJsDrizzleProbeDriver } from '../../lib/sandbox/local-postgres-js-drizzle-driver'

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

test('KAN-585 constructs installed postgres.js and Drizzle without opening a connection or running SQL', async () => {
  const driver = createLocalPostgresJsDrizzleProbeDriver({ directUrl: localUrl })
  try {
    assert.equal(typeof driver.database.transaction, 'function')
    // No transaction invocation: this test must not contact PostgreSQL or run DDL.
  } finally {
    await driver.close()
  }
})

test('KAN-585 rejects remote URL before constructing a PostgreSQL client', () => {
  assert.throws(
    () => createLocalPostgresJsDrizzleProbeDriver({
      directUrl: 'postgresql://postgres:secret@db.example.org:5432/postgres',
    }),
    /sandbox|local|endpoint/i,
  )
})

test('KAN-585 ensures a local Drizzle probe driver cannot be made without an explicit URL', () => {
  assert.throws(
    () => createLocalPostgresJsDrizzleProbeDriver({}),
    /sandbox|local|URL|explicit/i,
  )
})
