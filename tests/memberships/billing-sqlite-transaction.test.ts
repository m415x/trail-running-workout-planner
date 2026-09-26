import assert from 'node:assert/strict'
import test from 'node:test'

import { createSqliteBillingTransaction } from '../../lib/memberships/billing-sqlite-transaction'

test('SQLite billing transaction does not accept an async operation', () => {
  const db = {
    transaction: (
      operation: () => unknown,
      ?: { behavior?: 'deferred' | 'immediate' | 'exclusive' },
    ) => operation(),
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
    transaction: (
      operation: () => unknown,
      ?: { behavior?: 'deferred' | 'immediate' | 'exclusive' },
    ) => {
      calls.push('begin')
      const result = operation()
      calls.push('commit')
      return result
    },
  }

  const transaction = createSqliteBillingTransaction(db)
  const result = transaction(() => {
    calls.push('write')
    return 'done'
  })

  assert.equal(result, 'done')
  assert.deepEqual(calls, ['begin', 'write', 'commit'])
})


test('SQLite billing transaction matches Drizzle better-sqlite3 immediate transaction options', () => {
  const calls: string[] = []
  const db = {
    transaction: (
      operation: () => unknown,
      config?: { behavior?: 'deferred' | 'immediate' | 'exclusive' },
    ) => {
      calls.push(`behavior:${String(config?.behavior)}`)
      calls.push('begin')
      const result = operation()
      calls.push('commit')
      return result
    },
  }

  const transaction = createSqliteBillingTransaction(db)
  const result = transaction(() => {
    calls.push('write')
    return 'done'
  })

  assert.equal(result, 'done')
  assert.deepEqual(calls, ['behavior:immediate', 'begin', 'write', 'commit'])
})
