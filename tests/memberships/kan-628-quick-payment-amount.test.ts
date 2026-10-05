import assert from 'node:assert/strict'
import test from 'node:test'

import { parseQuickPaymentAmountMinor } from '../../lib/memberships/quick-payment-amount'

test('KAN-628 converts exact decimal amount into minor units without floating point rounding', () => {
  assert.equal(parseQuickPaymentAmountMinor('0.01'), 1)
  assert.equal(parseQuickPaymentAmountMinor('12500.50'), 1250050)
  assert.equal(parseQuickPaymentAmountMinor('12500,50'), 1250050)
  assert.equal(parseQuickPaymentAmountMinor('25000'), 2500000)
})

test('KAN-628 rejects ambiguous, unsafe, negative and excess-precision amounts', () => {
  for (const value of ['-1', '1.001', '1,000.00', '1.2.3', '', 'Infinity', '1e5', '90071992547410.00']) {
    assert.equal(parseQuickPaymentAmountMinor(value), null, value)
  }
})
