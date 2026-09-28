import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyPaymentRevision,
  deriveMonthlyChargePaymentBalance,
  type MonthlyChargeCandidate,
  type PaymentRevision,
} from '@/lib/memberships/billing'

const charge: MonthlyChargeCandidate = {
  athleteId: 'athlete-1',
  billingTermsId: 'terms-1',
  year: 2026,
  month: 10,
  baseAmountMinor: 2_500_000,
  amountDueMinor: 2_000_000,
  currency: 'ARS',
  baseDueDate: '2026-10-05',
  effectiveDueDate: '2026-10-05',
}

test('H3 admits only cash and bank_transfer as manual payment methods', () => {
  const cash = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })
  const transfer = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-2',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-04',
    voided: false,
  })

  assert.equal(cash[0]?.paymentMethod, 'cash')
  assert.equal(transfer[0]?.paymentMethod, 'bank_transfer')
})

test('Payment revisions preserve one logical identity and corrections are append-only', () => {
  const initial = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })
  const corrected = applyPaymentRevision({
    revisions: initial,
    revisionId: 'payment-revision-2',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })

  assert.equal(corrected.length, 2)
  assert.equal(corrected.filter(revision => revision.isCurrent).length, 1)
  assert.equal(corrected[0]?.isCurrent, false)
  assert.equal(corrected[1]?.amountMinor, 750_000)
  assert.equal(corrected[1]?.paymentId, 'payment-1')
  assert.equal(corrected[1]?.monthlyChargeId, 'charge-1')
})

test('voiding a payment appends history and removes that logical payment from the effective paid amount', () => {
  const initial = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-03',
    voided: false,
  })
  const voided = applyPaymentRevision({
    revisions: initial,
    revisionId: 'payment-revision-2',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-03',
    voided: true,
  })

  assert.equal(voided.length, 2)
  assert.equal(voided.filter(revision => revision.isCurrent).length, 1)

  const balance = deriveMonthlyChargePaymentBalance({
    charge,
    monthlyChargeId: 'charge-1',
    paymentRevisions: voided,
  })

  assert.deepEqual(balance, {
    amountDueMinor: 2_000_000,
    paidMinor: 0,
    remainingMinor: 2_000_000,
  })
})

test('only current effective revisions participate in the paid and remaining projection', () => {
  const paymentOne: PaymentRevision[] = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-1-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })
  const paymentOneCorrected = applyPaymentRevision({
    revisions: paymentOne,
    revisionId: 'payment-1-revision-2',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })
  const paymentTwo: PaymentRevision[] = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-2-revision-1',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-04',
    voided: false,
  })

  assert.deepEqual(
    deriveMonthlyChargePaymentBalance({
      charge,
      monthlyChargeId: 'charge-1',
      paymentRevisions: [...paymentOneCorrected, ...paymentTwo],
    }),
    {
      amountDueMinor: 2_000_000,
      paidMinor: 1_000_000,
      remainingMinor: 1_000_000,
    },
  )
})

test('effective payments cannot exceed the H2-effective amount due', () => {
  const first = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-1-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })
  const second = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-2-revision-1',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-04',
    voided: false,
  })

  assert.throws(
    () => deriveMonthlyChargePaymentBalance({
      charge,
      monthlyChargeId: 'charge-1',
      paymentRevisions: [...first, ...second],
    }),
    /amount due|overpay|exceed/i,
  )
})

test('payment amounts are positive integer minor units and paidAt is an explicit economic date', () => {
  assert.throws(
    () => applyPaymentRevision({
      revisions: [],
      revisionId: 'payment-revision-zero',
      paymentId: 'payment-zero',
      monthlyChargeId: 'charge-1',
      amountMinor: 0,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
      voided: false,
    }),
    /amount|positive|minor/i,
  )

  assert.throws(
    () => applyPaymentRevision({
      revisions: [],
      revisionId: 'payment-revision-date',
      paymentId: 'payment-date',
      monthlyChargeId: 'charge-1',
      amountMinor: 100_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-99',
      voided: false,
    }),
    /date|paidAt/i,
  )
})

test('a revision stream cannot mix another Payment or MonthlyCharge identity', () => {
  const initial = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'cash',
    paidAt: '2026-10-03',
    voided: false,
  })

  assert.throws(
    () => applyPaymentRevision({
      revisions: initial,
      revisionId: 'payment-revision-2',
      paymentId: 'payment-2',
      monthlyChargeId: 'charge-1',
      amountMinor: 500_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
      voided: false,
    }),
    /identity|payment/i,
  )

  assert.throws(
    () => applyPaymentRevision({
      revisions: initial,
      revisionId: 'payment-revision-3',
      paymentId: 'payment-1',
      monthlyChargeId: 'charge-2',
      amountMinor: 500_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
      voided: false,
    }),
    /identity|charge/i,
  )
})

test('balance projection rejects ambiguous current revisions for one logical Payment', () => {
  const ambiguous: PaymentRevision[] = [
    {
      revisionId: 'payment-revision-1',
      paymentId: 'payment-1',
      monthlyChargeId: 'charge-1',
      amountMinor: 500_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
      voided: false,
      isCurrent: true,
    },
    {
      revisionId: 'payment-revision-2',
      paymentId: 'payment-1',
      monthlyChargeId: 'charge-1',
      amountMinor: 750_000,
      paymentMethod: 'cash',
      paidAt: '2026-10-03',
      voided: false,
      isCurrent: true,
    },
  ]

  assert.throws(
    () => deriveMonthlyChargePaymentBalance({
      charge,
      monthlyChargeId: 'charge-1',
      paymentRevisions: ambiguous,
    }),
    /ambiguous|current|revision/i,
  )
})
