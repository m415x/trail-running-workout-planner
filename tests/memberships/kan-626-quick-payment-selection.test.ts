import assert from 'node:assert/strict'
import test from 'node:test'

import { selectQuickPaymentCharge } from '../../lib/memberships/quick-payment-selection'

const october = {
  id: 'charge-oct',
  year: 2026,
  month: 10,
  currency: 'ARS',
  remainingMinor: 2500000,
  status: 'pending' as const,
}
const september = {
  id: 'charge-sep',
  year: 2026,
  month: 9,
  currency: 'ARS',
  remainingMinor: 1200000,
  status: 'overdue' as const,
}

test('KAN-626 list preselects a positive-current-month balance while warning about prior overdue debt', () => {
  const result = selectQuickPaymentCharge({
    charges: [september, october],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'list' },
    blockedForPriorDebt: true,
  })
  assert.equal(result.selectedChargeId, 'charge-oct')
  assert.equal(result.hasPriorOverdueDebt, true)
  assert.deepEqual(result.eligibleChargeIds, ['charge-sep', 'charge-oct'])
})

test('KAN-626 detail always selects the exact eligible charge requested', () => {
  const result = selectQuickPaymentCharge({
    charges: [september, october],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'charge', monthlyChargeId: 'charge-sep' },
    blockedForPriorDebt: true,
  })
  assert.equal(result.selectedChargeId, 'charge-sep')
})

test('KAN-626 does not silently select a historical charge if current month has no eligible charge', () => {
  const result = selectQuickPaymentCharge({
    charges: [september],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'list' },
    blockedForPriorDebt: true,
  })
  assert.equal(result.selectedChargeId, null)
  assert.deepEqual(result.eligibleChargeIds, ['charge-sep'])
})

test('KAN-626 excludes settled charges and preserves unknown without inventing charges', () => {
  const settled = { ...october, remainingMinor: 0, status: 'settled' as const }
  const result = selectQuickPaymentCharge({
    charges: [settled, september],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'list' },
    blockedForPriorDebt: false,
  })
  assert.equal(result.selectedChargeId, null)
  assert.deepEqual(result.eligibleChargeIds, ['charge-sep'])
  const empty = selectQuickPaymentCharge({
    charges: [],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'list' },
    blockedForPriorDebt: false,
  })
  assert.equal(empty.selectedChargeId, null)
  assert.deepEqual(empty.eligibleChargeIds, [])
})

test('KAN-626 keeps currencies and remaining minor amounts unchanged', () => {
  const usd = { ...october, id: 'usd-oct', currency: 'USD', remainingMinor: 12345 }
  const result = selectQuickPaymentCharge({
    charges: [usd],
    currentPeriod: { year: 2026, month: 10 },
    source: { kind: 'list' },
    blockedForPriorDebt: false,
  })
  assert.equal(result.selectedChargeId, 'usd-oct')
  assert.equal(result.eligibleCharges[0]?.currency, 'USD')
  assert.equal(result.eligibleCharges[0]?.remainingMinor, 12345)
})
