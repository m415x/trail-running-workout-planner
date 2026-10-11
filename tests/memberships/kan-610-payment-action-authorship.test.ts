import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment entrypoints forward trusted H2 authorship to runtime on all three mutations', () => {
  const source = readFileSync('app/actions/membership-actions.ts', 'utf8')
  const start = source.indexOf('const authorizedPayments =')
  assert.ok(start >= 0, 'authorized H6 payments boundary must exist')
  const end = source.indexOf('export async function registerManualPaymentAction(', start)
  assert.ok(end > start, 'payment action exports must exist')
  const body = source.slice(start, end)
  for (const [method, runtime] of [
    ['register:', 'runtime.registerManualPayment'],
    ['correct:', 'runtime.correctManualPayment'],
    ['voidPayment:', 'runtime.voidManualPayment'],
  ]) {
    const index = body.indexOf(method)
    assert.ok(index >= 0, method)
    const next = body.indexOf('revalidate:', index)
    const action = body.slice(index, next)
    assert.ok(action.includes(runtime), runtime)
    assert.match(action, /authorship:\s*authorship/, method + ' must forward server-derived authorship')
  }
})
