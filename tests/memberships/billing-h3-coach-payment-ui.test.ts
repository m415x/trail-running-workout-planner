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
  assert.match(form, /t\('payments\.cash'\)/)
  assert.match(form, /t\('payments\.bankTransfer'\)/)
  assert.match(form, /t\('payments\.paid'\)/)
  assert.match(form, /t\('payments\.remaining'\)/)
  assert.match(form, /t\('payments\.history'\)/)
  assert.match(form, /paymentHistory/)
  assert.match(form, /paidAmountMinor/)
  assert.match(form, /remainingAmountMinor/)
  assert.match(page, /paymentHistory={membership\.paymentHistory}/)
  assert.match(actions, /registerManualPaymentAction/)
  assert.doesNotMatch(form, /['"](?:settled|pending|overdue)['"]/i)
  assert.doesNotMatch(form, /paymentStatus|chargeStatus|accountStatus/)
})
