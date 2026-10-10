import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 persistence adapter preserves H2 author when validating all three economic exceptions', () => {
  const source = readFileSync('lib/memberships/billing-persistence.ts', 'utf8')
  for (const [action, next] of [
    ['async applyGlobalDueDateException(', 'async applyMonthlyChargeReduction('],
    ['async applyMonthlyChargeReduction(', 'async applyMonthlyChargeExtension('],
    ['async applyMonthlyChargeExtension(', 'async registerManualPayment('],
  ]) {
    const start = source.indexOf(action)
    assert.ok(start >= 0, action)
    const end = source.indexOf(next, start + 1)
    const body = source.slice(start, end < 0 ? undefined : end)
    assert.ok(body.includes('createdByUserId: input.revision.createdByUserId'), action + ' must preserve verified author when constructing validated revision')
  }
})
