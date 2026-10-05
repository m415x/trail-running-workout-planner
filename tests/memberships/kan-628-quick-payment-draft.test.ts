import assert from 'node:assert/strict'
import test from 'node:test'

import {
  prepareQuickPaymentDraft,
  validateQuickPaymentDraft,
} from '../../lib/memberships/quick-payment-draft'

const charges = [
  { id: 'sep', year: 2026, month: 9, currency: 'ARS', remainingMinor: 1800, status: 'overdue' as const },
  { id: 'oct', year: 2026, month: 10, currency: 'ARS', remainingMinor: 2500000, status: 'pending' as const },
]

test('KAN-628 defaults to remaining current charge, cash, and explicit operational civil date', () => {
  const draft = prepareQuickPaymentDraft({
    charges,
    currentPeriod: { year: 2026, month: 10 },
    operationalDate: '2026-10-05',
    source: { kind: 'list' },
    blockedForPriorDebt: true,
  })
  assert.equal(draft.monthlyChargeId, 'oct')
  assert.equal(draft.amountMinor, 2500000)
  assert.equal(draft.currency, 'ARS')
  assert.equal(draft.paymentMethod, 'cash')
  assert.equal(draft.paidAt, '2026-10-05')
  assert.equal(draft.hasPriorOverdueDebt, true)
})

test('KAN-628 does not prefill historical money when current period is missing', () => {
  const draft = prepareQuickPaymentDraft({
    charges: [charges[0]!],
    currentPeriod: { year: 2026, month: 10 },
    operationalDate: '2026-10-05',
    source: { kind: 'list' },
    blockedForPriorDebt: false,
  })
  assert.equal(draft.monthlyChargeId, null)
  assert.equal(draft.amountMinor, null)
  assert.equal(draft.currency, null)
})

test('KAN-628 validates partial payment without changing minor units', () => {
  const result = validateQuickPaymentDraft({
    charges,
    athleteId: 'athlete-1',
    monthlyChargeId: 'oct',
    amountMinor: 1250000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-05',
    locale: 'es',
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.amountMinor, 1250000)
    assert.equal(result.value.athleteId, 'athlete-1')
    assert.equal(result.value.monthlyChargeId, 'oct')
  }
})

test('KAN-628 rejects overpayment, non-integers, missing charge, and invalid date', () => {
  const valid = {
    charges,
    athleteId: 'athlete-1',
    monthlyChargeId: 'oct',
    amountMinor: 200,
    paymentMethod: 'cash' as const,
    paidAt: '2026-10-05',
    locale: 'es' as const,
  }
  for (const change of [
    { amountMinor: 2500001 },
    { amountMinor: 0 },
    { amountMinor: 10.5 },
    { monthlyChargeId: 'unknown' },
    { paidAt: '2026-02-30' },
    { paymentMethod: 'card' },
  ]) {
    const result = validateQuickPaymentDraft({ ...valid, ...change })
    assert.equal(result.ok, false, JSON.stringify(change))
  }
})
