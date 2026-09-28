import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  explainMonthlyChargeEconomics,
  type AthleteBillingTerms,
  type GlobalDueDateExceptionRevision,
  type MonthlyChargeCandidate,
  type MonthlyChargeExtensionRevision,
  type MonthlyChargeReductionRevision,
  type PaymentRevision,
} from '@/lib/memberships/billing'

const terms: AthleteBillingTerms = {
  id: 'terms-1',
  athleteId: 'athlete-1',
  monthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  effectiveFrom: '2026-09-01',
  effectiveUntil: null,
}

const charge: MonthlyChargeCandidate = {
  athleteId: 'athlete-1',
  billingTermsId: 'terms-1',
  year: 2026,
  month: 9,
  baseAmountMinor: 2_500_000,
  amountDueMinor: 2_000_000,
  currency: 'ARS',
  baseDueDate: '2026-09-08',
  effectiveDueDate: '2026-09-12',
}

const globalDueDateHistory: GlobalDueDateExceptionRevision[] = [
  {
    id: 'global-1',
    teamId: 'team-1',
    year: 2026,
    month: 9,
    dueDate: '2026-09-08',
    reason: 'Holiday adjustment',
    isCurrent: true,
  },
]

const reductionHistory: MonthlyChargeReductionRevision[] = [
  {
    id: 'reduction-1',
    athleteId: 'athlete-1',
    year: 2026,
    month: 9,
    reductionAmountMinor: 250_000,
    reason: 'Initial scholarship',
    isCurrent: false,
  },
  {
    id: 'reduction-2',
    athleteId: 'athlete-1',
    year: 2026,
    month: 9,
    reductionAmountMinor: 500_000,
    reason: 'Corrected scholarship',
    isCurrent: true,
  },
]

const extensionHistory: MonthlyChargeExtensionRevision[] = [
  {
    id: 'extension-1',
    athleteId: 'athlete-1',
    year: 2026,
    month: 9,
    extendedDueDate: '2026-09-12',
    reason: 'Individual extension',
    isCurrent: true,
  },
]

const paymentHistory: PaymentRevision[] = [
  {
    revisionId: 'payment-rev-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 500_000,
    paymentMethod: 'cash',
    paidAt: '2026-09-05',
    voided: false,
    isCurrent: false,
  },
  {
    revisionId: 'payment-rev-2',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 750_000,
    paymentMethod: 'cash',
    paidAt: '2026-09-05',
    voided: false,
    isCurrent: true,
  },
  {
    revisionId: 'payment-rev-3',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-09-06',
    voided: false,
    isCurrent: false,
  },
  {
    revisionId: 'payment-rev-4',
    paymentId: 'payment-2',
    monthlyChargeId: 'charge-1',
    amountMinor: 250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-09-06',
    voided: true,
    isCurrent: true,
  },
]

test('H4 explains one charge from H1/H2/H3 facts without creating a parallel ledger', () => {
  const explanation = explainMonthlyChargeEconomics({
    teamId: 'team-1',
    cutoffDate: '2026-09-13',
    monthlyChargeId: 'charge-1',
    terms,
    charge,
    globalDueDateHistory,
    reductionHistory,
    extensionHistory,
    paymentHistory,
  })

  assert.deepEqual(explanation.condition, {
    billingTermsId: 'terms-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-09-01',
    effectiveUntil: null,
  })

  assert.deepEqual(explanation.charge, {
    monthlyChargeId: 'charge-1',
    year: 2026,
    month: 9,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_000_000,
    currency: 'ARS',
    baseDueDate: '2026-09-08',
    effectiveDueDate: '2026-09-12',
  })

  assert.deepEqual(
    explanation.globalDueDateHistory.map(item => ({
      id: item.id,
      dueDate: item.dueDate,
      reason: item.reason,
      state: item.state,
    })),
    [{
      id: 'global-1',
      dueDate: '2026-09-08',
      reason: 'Holiday adjustment',
      state: 'current',
    }],
  )

  assert.deepEqual(
    explanation.reductionHistory.map(item => ({
      id: item.id,
      reductionAmountMinor: item.reductionAmountMinor,
      state: item.state,
    })),
    [
      { id: 'reduction-1', reductionAmountMinor: 250_000, state: 'historical' },
      { id: 'reduction-2', reductionAmountMinor: 500_000, state: 'current' },
    ],
  )

  assert.deepEqual(
    explanation.extensionHistory.map(item => ({
      id: item.id,
      extendedDueDate: item.extendedDueDate,
      state: item.state,
    })),
    [{
      id: 'extension-1',
      extendedDueDate: '2026-09-12',
      state: 'current',
    }],
  )

  assert.deepEqual(
    explanation.paymentHistory.map(item => ({
      revisionId: item.revisionId,
      paymentId: item.paymentId,
      amountMinor: item.amountMinor,
      state: item.state,
    })),
    [
      {
        revisionId: 'payment-rev-1',
        paymentId: 'payment-1',
        amountMinor: 500_000,
        state: 'historical',
      },
      {
        revisionId: 'payment-rev-2',
        paymentId: 'payment-1',
        amountMinor: 750_000,
        state: 'current',
      },
      {
        revisionId: 'payment-rev-3',
        paymentId: 'payment-2',
        amountMinor: 250_000,
        state: 'historical',
      },
      {
        revisionId: 'payment-rev-4',
        paymentId: 'payment-2',
        amountMinor: 250_000,
        state: 'voided',
      },
    ],
  )

  assert.deepEqual(explanation.result, {
    status: 'overdue',
    amountDueMinor: 2_000_000,
    paidMinor: 750_000,
    remainingMinor: 1_250_000,
    effectiveDueDate: '2026-09-12',
    currency: 'ARS',
  })
})

test('H4 explanation rejects facts that do not belong to the same charge context', () => {
  assert.throws(
    () => explainMonthlyChargeEconomics({
      teamId: 'team-1',
      cutoffDate: '2026-09-13',
      monthlyChargeId: 'charge-1',
      terms,
      charge,
      globalDueDateHistory: [{
        ...globalDueDateHistory[0]!,
        teamId: 'other-team',
      }],
      reductionHistory,
      extensionHistory,
      paymentHistory,
    }),
    /team|identity|context/i,
  )

  assert.throws(
    () => explainMonthlyChargeEconomics({
      teamId: 'team-1',
      cutoffDate: '2026-09-13',
      monthlyChargeId: 'charge-1',
      terms: { ...terms, id: 'other-terms' },
      charge,
      globalDueDateHistory,
      reductionHistory,
      extensionHistory,
      paymentHistory,
    }),
    /terms|identity|context/i,
  )
})
