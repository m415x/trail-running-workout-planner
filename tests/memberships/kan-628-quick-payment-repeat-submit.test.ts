import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../../features/memberships/components/QuickPaymentDialog.tsx', import.meta.url), 'utf8')

test('KAN-628 retains the successful submission lock until a new dialog opening', () => {
  assert.match(source, /submittedRef\.current/)
  assert.match(source, /submittedRef\.current = true/)
  assert.match(source, /if \(pendingRef\.current \|\| submittedRef\.current\) return/)
  assert.match(source, /submittedRef\.current = false/)
})

test('KAN-628 does not enable another payment after success in the same dialog', () => {
  assert.match(source, /disabled=\{isPending \|\| submitted/)
})
