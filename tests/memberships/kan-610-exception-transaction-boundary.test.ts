import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 async exception adapter delegates atomic writes to the Drizzle transaction port', () => {
  const adapter = readFileSync('lib/memberships/billing-persistence.ts', 'utf8')
  const database = readFileSync('lib/memberships/billing-drizzle-database.ts', 'utf8')
  const global = adapter.slice(adapter.indexOf('async applyGlobalDueDateException('), adapter.indexOf('async applyMonthlyChargeReduction('))
  assert.ok(global.includes('await h2Port.applyGlobalDueDateExceptionAtomically('))
  assert.ok(global.includes("throw new Error('Billing persistence does not support atomic global due-date exceptions')"))
  assert.ok(!global.includes('await h2Port.replaceCurrentGlobalDueDateException('))
  for (const action of ['applyGlobalDueDateExceptionAtomically', 'applyMonthlyChargeReductionAtomically', 'applyMonthlyChargeExtensionAtomically']) {
    const start = database.indexOf('async ' + action + '(')
    assert.ok(start >= 0, action)
    const next = database.indexOf('\n    async ', start + 1)
    const implementation = database.slice(start, next < 0 ? undefined : next)
    assert.ok(implementation.includes('client.transaction((tx) =>'), action + ' must use a Drizzle transaction')
  }
})
