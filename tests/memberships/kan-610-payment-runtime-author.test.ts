import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment runtime writes H2 effective actor in all three revision operations', () => {
  const source = readFileSync('lib/memberships/billing-server-action-runtime.ts', 'utf8')
  for (const action of ['registerManualPayment', 'correctManualPayment', 'voidManualPayment']) {
    const start = source.indexOf('async ' + action + '(input:')
    assert.ok(start >= 0, action)
    const end = source.indexOf('\n    async ', start + 1)
    const body = source.slice(start, end < 0 ? undefined : end)
    assert.ok(body.includes('createdByUserId: input.authorship?.effectiveActorUserId ?? null'), action + ' must use authenticated H2 actor, not client input')
  }
})
