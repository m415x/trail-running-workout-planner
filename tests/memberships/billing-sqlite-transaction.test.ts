import assert from 'node:assert/strict'
import test from 'node:test'

import { createSqliteBillingTransaction } from '../../lib/memberships/billing-sqlite-transaction'

test('SQLite billing transaction does not accept an async operation', () => {
  const db = {
    transaction: (operation: () => unknown) => ({
      immediate: () => operation(),
    }),
  }

  const transaction = createSqliteBillingTransaction(db)

  assert.throws(
    () => transaction(async () => undefined),
    /SQLite billing transaction operation must be synchronous/,
  )
})

test('SQLite billing transaction completes synchronous work before returning', () => {
  const calls: string[] = []
  const db = {
    transaction: (operation: () => unknown) => ({
      immediate: () => {
        calls.push('begin')
        const result = operation()
        calls.push('commit')
        return result
      },
    }),
  }

  const transaction = createSqliteBillingTransaction(db)
  const result = transaction(() => {
    calls.push('write')
    return 'done'
  })

  assert.equal(result, 'done')
  assert.deepEqual(calls, ['begin', 'write', 'commit'])
})
