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

  assert.match(source, /model\.mode === 'replacement'/)
  assert.match(source, /name='effectiveFrom'/)
  assert.match(source, /name='monthlyAmount'/)
  assert.match(source, /name='currency'/)
  assert.doesNotMatch(source, /scholarship|beca|payment|pago|overdue|deuda|extension|prórroga/i)
})
