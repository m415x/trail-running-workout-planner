import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  deriveMembershipAccountState,
  type MonthlyChargeCandidate,
  type PaymentRevision,
} from '@/lib/memberships/billing'

function charge(overrides: Partial<MonthlyChargeCandidate> = {}): MonthlyChargeCandidate {
  return {
    athleteId: 'athlete-1',
    billingTermsId: 'terms-1',
    year: 2026,
    month: 9,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_000_000,
    currency: 'ARS',
    baseDueDate: '2026-09-05',
    effectiveDueDate: '2026-09-10',
    ...overrides,
  }
}

function payment(input: {
  revisionId: string
  paymentId: string
  monthlyChargeId: string
  amountMinor: number
}): PaymentRevision {
  return {
    revisionId: input.revisionId,
    paymentId: input.paymentId,
    monthlyChargeId: input.monthlyChargeId,
    amountMinor: input.amountMinor,
    paymentMethod: 'cash',
    paidAt: '2026-09-03',
    voided: false,
    isCurrent: true,
  }
}

test('H4 derives settled, pending and overdue from an explicit civil cutoff date', () => {
  const model = deriveMembershipAccountState({
    cutoffDate: '2026-09-10',
    charges: [
      {
        id: 'settled-charge',
        charge: charge({ year: 2026, month: 7, effectiveDueDate: '2026-07-10' }),
        paymentRevisions: [
          payment({
            revisionId: 'settled-payment-revision',
            paymentId: 'settled-payment',
            monthlyChargeId: 'settled-charge',
            amountMinor: 2_000_000,
          }),
        ],
      },
      {
        id: 'pending-charge',
        charge: charge({ year: 2026, month: 9, effectiveDueDate: '2026-09-10' }),
        paymentRevisions: [],
      },
      {
        id: 'overdue-charge',
        charge: charge({ year: 2026, month: 8, effectiveDueDate: '2026-09-09' }),
        paymentRevisions: [],
      },
    ],
  })

  assert.deepEqual(
    model.charges.map(item => ({
      id: item.id,
      status: item.status,
      paidMinor: item.paidMinor,
      remainingMinor: item.remainingMinor,
    })),
    [
      {
        id: 'settled-charge',
        status: 'settled',
        paidMinor: 2_000_000,
        remainingMinor: 0,
      },
      {
        id: 'pending-charge',
        status: 'pending',
        paidMinor: 0,
        remainingMinor: 2_000_000,
      },
      {
        id: 'overdue-charge',
        status: 'overdue',
        paidMinor: 0,
        remainingMinor: 2_000_000,
      },
    ],
  )
})

test('effectiveDueDate is inclusive: a positive balance stays pending on its due date', () => {
  const model = deriveMembershipAccountState({
    cutoffDate: '2026-09-10',
    charges: [{
      id: 'charge-1',
      charge: charge({ effectiveDueDate: '2026-09-10' }),
      paymentRevisions: [],
    }],
  })

  assert.equal(model.charges[0]?.status, 'pending')
})

test('the day 10 has no special economic meaning beyond the actual effective due date', () => {
  const beforeDueDate = deriveMembershipAccountState({
    cutoffDate: '2026-09-10',
    charges: [{
      id: 'charge-before-due',
      charge: charge({ effectiveDueDate: '2026-09-15' }),
      paymentRevisions: [],
    }],
  })
  const afterDueDate = deriveMembershipAccountState({
    cutoffDate: '2026-09-10',
    charges: [{
      id: 'charge-after-due',
      charge: charge({ effectiveDueDate: '2026-09-05' }),
      paymentRevisions: [],
    }],
  })

  assert.equal(beforeDueDate.charges[0]?.status, 'pending')
  assert.equal(afterDueDate.charges[0]?.status, 'overdue')
})

test('H4 validates cutoffDate as an explicit YYYY-MM-DD civil date', () => {
  assert.throws(
    () => deriveMembershipAccountState({
      cutoffDate: '2026-09-31',
      charges: [],
    }),
    /date|cutoff/i,
  )

  assert.throws(
    () => deriveMembershipAccountState({
      cutoffDate: '09/10/2026',
      charges: [],
    }),
    /date|cutoff/i,
  )
})

test('account balance is derived by currency instead of summing unlike monetary units', () => {
  const model = deriveMembershipAccountState({
    cutoffDate: '2026-09-20',
    charges: [
      {
        id: 'ars-charge',
        charge: charge({
          currency: 'ARS',
          amountDueMinor: 2_000_000,
          effectiveDueDate: '2026-09-10',
        }),
        paymentRevisions: [
          payment({
            revisionId: 'ars-payment-revision',
            paymentId: 'ars-payment',
            monthlyChargeId: 'ars-charge',
            amountMinor: 500_000,
          }),
        ],
      },
      {
        id: 'usd-charge',
        charge: charge({
          currency: 'USD',
          amountDueMinor: 10_000,
          effectiveDueDate: '2026-09-10',
        }),
        paymentRevisions: [],
      },
    ],
  })

  assert.deepEqual(model.balanceByCurrency, [
    {
      currency: 'ARS',
      amountDueMinor: 2_000_000,
      paidMinor: 500_000,
      remainingMinor: 1_500_000,
    },
    {
      currency: 'USD',
      amountDueMinor: 10_000,
      paidMinor: 0,
      remainingMinor: 10_000,
    },
  ])
})
