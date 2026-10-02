import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SQL } from 'drizzle-orm/sql'

import { createDrizzleTransactionIdentityQuery } from '../../lib/sandbox/drizzle-identity-query-adapter'

test('KAN-585 sends identity SQL to Drizzle as a SQL object, never a plain string', async () => {
  const queries: string[] = []
  const query = createDrizzleTransactionIdentityQuery({
    execute: async statement => {
      assert.ok(statement instanceof SQL)
      const rendered = new PgDialect().sqlToQuery(statement).sql
      queries.push(rendered)
      return [{ clusterSystemIdentifier: '1234567890123456789', database: 'postgres' }]
    },
  })

  const rows = await query('SELECT current_database() AS "database"')
  assert.deepEqual(rows, [{ clusterSystemIdentifier: '1234567890123456789', database: 'postgres' }])
  assert.deepEqual(queries, ['SELECT current_database() AS "database"'])
})

test('KAN-585 rejects malformed SQL driver rows and redacts raw driver failures', async () => {
  const malformed = createDrizzleTransactionIdentityQuery({ execute: async () => ({ rows: [] }) })
  await assert.rejects(() => malformed('SELECT current_database()'), /sandbox|drizzle|row/i)

  const failed = createDrizzleTransactionIdentityQuery({
    execute: async () => { throw new Error('postgresql://postgres:SUPER-SECRET@127.0.0.1') },
  })
  await assert.rejects(
    () => failed('SELECT current_database()'),
    (error: unknown) => error instanceof Error
      && /sandbox|drizzle|query/i.test(error.message)
      && !error.message.includes('SUPER-SECRET'),
  )
})
