import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createSqliteBillingPersistencePort } from '@/lib/memberships/billing-sqlite-persistence'
import type { PersistedPaymentRevision } from '@/lib/memberships/billing-persistence'

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
  ...previous,
  revisionId: 'payment-revision-2',
  amountMinor: 1_000_000,
  paymentMethod: 'bank_transfer',
  paidAt: '2026-10-04',
}

function createDatabase(overrides: Record<string, unknown> = {}) {
  return {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {},
    ...overrides,
  }
}

test('SQLite Payment port delegates current revision replacement exactly once', async () => {
  const calls: Array<{
    previous: PersistedPaymentRevision
    replacement: PersistedPaymentRevision
  }> = []
  const port = createSqliteBillingPersistencePort(createDatabase({
    replaceCurrentPaymentRevisionAtomically: async (
      prior: PersistedPaymentRevision,
      next: PersistedPaymentRevision,
    ) => {
      calls.push({ previous: prior, replacement: next })
    },
  }) as never)

  await port.replaceCurrentPaymentRevisionAtomically!(previous, replacement)

  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], { previous, replacement })
})

test('SQLite Payment port rejects identity drift before database delegation', async () => {
  let calls = 0
  const port = createSqliteBillingPersistencePort(createDatabase({
    replaceCurrentPaymentRevisionAtomically: async () => {
      calls += 1
    },
  }) as never)

  await assert.rejects(
    () => port.replaceCurrentPaymentRevisionAtomically!(previous, {
      ...replacement,
      paymentId: 'payment-2',
    }),
    /identity|payment/i,
  )

  await assert.rejects(
    () => port.replaceCurrentPaymentRevisionAtomically!(previous, {
      ...replacement,
      monthlyChargeId: 'charge-2',
    }),
    /identity|charge/i,
  )

  assert.equal(calls, 0)
})
