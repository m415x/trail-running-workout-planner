import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 global exception rejects missing atomic persistence instead of writing revision and charges separately', () => {
  const source = readFileSync('lib/memberships/billing-persistence.ts', 'utf8')
  const start = source.indexOf('async applyGlobalDueDateException(')
  const end = source.indexOf('async applyMonthlyChargeReduction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  assert.ok(action.includes('applyGlobalDueDateExceptionAtomically'), 'atomic writer must exist')
  assert.ok(action.includes("throw new Error('Billing persistence does not support atomic global due-date exceptions')"), 'missing atomic writer must DENY without mutation')
  assert.doesNotMatch(action, /await h2Port\.replaceCurrentGlobalDueDateException\(/, 'non-atomic fallback must be removed')
  assert.doesNotMatch(action, /await h2Port\.updateMonthlyChargeDueDates\(/, 'per-charge fallback must be removed')
})
