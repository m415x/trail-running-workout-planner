import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('Coach athlete membership surface exposes localized H3 payment entry, balances and history', async () => {
  const form = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const page = await readFile(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )
  const actions = await readFile(
    'app/actions/membership-actions.ts',
    'utf8',
  )

  assert.match(form, /registerManualPaymentAction/)
  assert.match(form, /Efectivo/)
  assert.match(form, /Cash/)
  assert.match(form, /Transferencia bancaria/)
  assert.match(form, /Bank transfer/)
  assert.match(form, /Pagado/)
  assert.match(form, /Paid/)
  assert.match(form, /Restante/)
  assert.match(form, /Remaining/)
  assert.match(form, /Historial de pagos/)
  assert.match(form, /Payment history/)
  assert.match(form, /paymentHistory/)
  assert.match(form, /paidAmountMinor/)
  assert.match(form, /remainingAmountMinor/)
  assert.match(page, /paymentHistory={membership\.paymentHistory}/)
  assert.match(actions, /registerManualPaymentAction/)
  assert.doesNotMatch(form, /['"](?:settled|pending|overdue)['"]/i)
  assert.doesNotMatch(form, /paymentStatus|chargeStatus|accountStatus/)
})
