import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

test('athlete billing terms form is interactive and delegates through the H1 submission boundary', async () => {
  const source = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.match(source, /'use client'/)
  assert.match(source, /submitAthleteBillingTermsForm/)
  assert.match(source, /applyInitialAthleteBillingTermsAction/)
  assert.match(source, /changeAthleteBillingTermsAction/)
  assert.match(source, /useTransition/)
  assert.match(source, /disabled=\{isPending\}/)
  assert.match(source, /role='alert'/)
})

test('athlete billing terms form keeps initial and replacement inputs distinct', async () => {
  const source = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )
  const h1FormSource = source.slice(
    source.indexOf('export function AthleteBillingTermsForm'),
    source.indexOf('{monthlyCharges.length > 0'),
  )
  const h1SubmitSource = source.slice(
    source.indexOf('function handleSubmit'),
    source.indexOf('  return (', source.indexOf('function handleSubmit')),
  )

  assert.match(h1FormSource, /model\.mode === 'replacement'/)
  assert.match(h1FormSource, /name='effectiveFrom'/)
  assert.match(h1FormSource, /name='monthlyAmount'/)
  assert.match(h1FormSource, /name='currency'/)
  assert.doesNotMatch(h1SubmitSource, /applyMonthlyChargeReductionAction/)
  assert.doesNotMatch(h1SubmitSource, /applyMonthlyChargeExtensionAction/)
  assert.doesNotMatch(h1SubmitSource, /registerManualPaymentAction/)
  assert.doesNotMatch(h1SubmitSource, /correctManualPaymentAction/)
  assert.doesNotMatch(h1SubmitSource, /voidManualPaymentAction/)
})

test('athlete billing terms form localizes action errors instead of exposing backend copy', async () => {
  const source = await readFile(
    'features/memberships/components/AthleteBillingTermsForm.tsx',
    'utf8',
  )

  assert.doesNotMatch(source, /setError\(result\.error/)
  assert.match(source, /setError\(copy\.genericError\)/)
})
