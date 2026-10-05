import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('../../features/memberships/components/QuickPaymentDialog.tsx', import.meta.url), 'utf8',
)

test('KAN-628 isolates accessible control ids across simultaneously mounted dialog instances', () => {
  assert.match(source, /useId\(/)
  assert.match(source, /id=\{periodId\}/)
  assert.match(source, /htmlFor=\{periodId\}/)
  assert.match(source, /id=\{amountId\}/)
  assert.match(source, /htmlFor=\{amountId\}/)
  assert.match(source, /id=\{methodId\}/)
  assert.match(source, /htmlFor=\{methodId\}/)
  assert.match(source, /id=\{dateId\}/)
  assert.match(source, /htmlFor=\{dateId\}/)
})
