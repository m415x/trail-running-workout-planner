import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentPath = new URL('../../features/memberships/components/QuickPaymentDialog.tsx', import.meta.url)

test('KAN-628 has one shared accessible quick payment dialog using existing H3 action', () => {
  const source = readFileSync(componentPath, 'utf8')
  assert.match(source, /export function QuickPaymentDialog/)
  assert.match(source, /DialogTitle/)
  assert.match(source, /DialogDescription/)
  assert.match(source, /DialogContent/)
  assert.match(source, /registerManualPaymentAction/)
  assert.match(source, /validateQuickPaymentDraft/)
})

test('KAN-628 distinguishes pending/error/success and guards repeated submissions', () => {
  const source = readFileSync(componentPath, 'utf8')
  assert.match(source, /role=['"]alert['"]/)
  assert.match(source, /role=['"]status['"]/)
  assert.match(source, /disabled=\{isPending/)
  assert.match(source, /pendingRef\.current/)
  assert.match(source, /onOpenChange/)
})

test('KAN-628 offers selection of periods and methods, date, amount and informative debt warning', () => {
  const source = readFileSync(componentPath, 'utf8')
  assert.match(source, /monthlyChargeId/)
  assert.match(source, /bank_transfer/)
  assert.match(source, /cash/)
  assert.match(source, /paidAt/)
  assert.match(source, /amountMinor/)
  assert.match(source, /hasPriorOverdueDebt/)
})
