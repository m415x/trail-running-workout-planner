import assert from 'node:assert/strict'
import test from 'node:test'

import { projectQuickPaymentBatch } from '../../lib/memberships/quick-payment-batch-projection'

const charges = [
  { id: 'a-sep', athleteId: 'athlete-a', billingTermsId: 'terms-a', year: 2026, month: 9, baseAmountMinor: 10000, amountDueMinor: 10000, currency: 'ARS', baseDueDate: '2026-09-05', effectiveDueDate: '2026-09-05' },
  { id: 'a-oct', athleteId: 'athlete-a', billingTermsId: 'terms-a', year: 2026, month: 10, baseAmountMinor: 20000, amountDueMinor: 15000, currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-15' },
  { id: 'b-oct', athleteId: 'athlete-b', billingTermsId: 'terms-b', year: 2026, month: 10, baseAmountMinor: 30000, amountDueMinor: 30000, currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-05' },
]

test('KAN-627 batches H4/H5 derivation without reinterpreting effective dates or active payment revisions', () => {
  const result = projectQuickPaymentBatch({
    requestedAthleteIds: ['athlete-a', 'athlete-b'],
    cutoffDate: '2026-10-06',
    charges,
    paymentRevisions: [
      { revisionId: 'r1', paymentId: 'p1', monthlyChargeId: 'a-oct', amountMinor: 4000, paymentMethod: 'cash' as const, paidAt: '2026-10-04', voided: false, isCurrent: false },
      { revisionId: 'r2', paymentId: 'p1', monthlyChargeId: 'a-oct', amountMinor: 6000, paymentMethod: 'cash' as const, paidAt: '2026-10-05', voided: false, isCurrent: true },
      { revisionId: 'r3', paymentId: 'p2', monthlyChargeId: 'b-oct', amountMinor: 30000, paymentMethod: 'bank_transfer' as const, paidAt: '2026-10-05', voided: true, isCurrent: true },
    ],
  })
  assert.deepEqual(result.map(row => row.athleteId), ['athlete-a', 'athlete-b'])
  assert.equal(result[0]?.blockedForPriorDebt, true)
  assert.deepEqual(result[0]?.charges.map(x => [x.id, x.remainingMinor, x.status]), [['a-sep', 10000, 'overdue'], ['a-oct', 9000, 'pending']])
  assert.equal(result[1]?.blockedForPriorDebt, false)
  assert.equal(result[1]?.charges[0]?.remainingMinor, 30000)
  assert.equal(result[1]?.charges[0]?.status, 'overdue')
})

test('KAN-627 batch projection refuses charges outside requested athlete scope', () => {
  assert.throws(() => projectQuickPaymentBatch({
    requestedAthleteIds: ['athlete-b'],
    cutoffDate: '2026-10-06',
    charges,
    paymentRevisions: [],
  }), /scope/i)
})

test('KAN-627 batch projection refuses payment history outside requested charge scope', () => {
  assert.throws(() => projectQuickPaymentBatch({
    requestedAthleteIds: ['athlete-b'],
    cutoffDate: '2026-10-06',
    charges: [charges[2]!],
    paymentRevisions: [{ revisionId: 'foreign', paymentId: 'p3', monthlyChargeId: 'a-oct', amountMinor: 100, paymentMethod: 'cash' as const, paidAt: '2026-10-05', voided: false, isCurrent: true }],
  }), /scope/i)
})
