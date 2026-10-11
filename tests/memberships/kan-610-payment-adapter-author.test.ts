import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment adapter preserves author through three payment revisions', () => {
  const source = readFileSync('lib/memberships/billing-persistence.ts', 'utf8')
  for (const action of ['registerManualPayment', 'correctManualPayment', 'voidManualPayment']) {
    const start = source.indexOf('async ' + action + '(')
    assert.ok(start >= 0, action)
    const next = source.indexOf('\n    async ', start + 1)
    const body = source.slice(start, next < 0 ? undefined : next)
    assert.ok(body.includes('createdByUserId: input.createdByUserId'), action + ' must forward author')
  }
})
