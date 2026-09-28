import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach H3 payment history exposes localized correction and void controls for current revisions', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )

  assert.match(form, /correctManualPaymentAction/)
  assert.match(form, /voidManualPaymentAction/)
  assert.match(form, /Corregir pago/)
  assert.match(form, /Correct payment/)
  assert.match(form, /Anular pago/)
  assert.match(form, /Void payment/)
  assert.match(form, /revision\.isCurrent/)
  assert.match(form, /revision\.voided/)
  assert.match(form, /paymentId/)
  assert.match(actions, /correctManualPaymentAction/)
  assert.match(actions, /voidManualPaymentAction/)
})

test('Coach H3 revision controls keep historical revisions read-only', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(form, /revision\.isCurrent && !revision\.voided/)
  assert.doesNotMatch(form, /deleteManualPayment|removeManualPayment/)
})
