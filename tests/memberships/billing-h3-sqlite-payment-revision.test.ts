import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createDrizzleBillingDatabase } from '@/lib/memberships/billing-drizzle-database'
import type { PersistedPaymentRevision } from '@/lib/memberships/billing-persistence'

test('Drizzle replaces the current Payment revision atomically inside one transaction', async () => {
  const operations: Array<{ kind: string; values?: Record<string, unknown> }> = []
  let transactions = 0

  const tx = {
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => operations.push({ kind: 'update', values }),
        }),
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>[]) => ({
        run: () => operations.push({ kind: 'insert', values: values[0] }),
      }),
    }),
  }

  const db = createDrizzleBillingDatabase({
    transaction: async (callback: (transaction: typeof tx) => void) => {
      transactions += 1
      callback(tx)
    },
  } as never)

  const previous: PersistedPaymentRevision = {
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
    isCurrent: true,
  }
  const replacement: PersistedPaymentRevision = {
    revisionId: 'payment-revision-2',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_000_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-04',
    voided: false,
    isCurrent: true,
  }

  await db.replaceCurrentPaymentRevisionAtomically!(previous, replacement)

  assert.equal(transactions, 1)
  assert.equal(operations.length, 2)
  assert.equal(operations[0]?.kind, 'update')
  assert.equal(operations[0]?.values?.isCurrent, false)
  assert.equal(operations[1]?.kind, 'insert')
  assert.equal(operations[1]?.values?.id, replacement.revisionId)
  assert.equal(operations[1]?.values?.paymentId, previous.paymentId)
  assert.equal(operations[1]?.values?.monthlyChargeId, previous.monthlyChargeId)
  assert.equal(operations[1]?.values?.isCurrent, true)
})

test('Payment replacement rejects a change of logical Payment or MonthlyCharge identity before writing', async () => {
  let transactions = 0
  const db = createDrizzleBillingDatabase({
    transaction: async () => {
      transactions += 1
    },
  } as never)

  const previous: PersistedPaymentRevision = {
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
    isCurrent: true,
  }

  await assert.rejects(
    () => db.replaceCurrentPaymentRevisionAtomically!(previous, {
      ...previous,
      revisionId: 'payment-revision-2',
      paymentId: 'payment-2',
    }),
    /identity|payment/i,
  )

  await assert.rejects(
    () => db.replaceCurrentPaymentRevisionAtomically!(previous, {
      ...previous,
      revisionId: 'payment-revision-3',
      monthlyChargeId: 'charge-2',
    }),
    /identity|charge/i,
  )

  assert.equal(transactions, 0)
})
