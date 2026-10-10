import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 economic exception runtime runs its billing writer inside SQLite transaction', () => {
  const source = readFileSync('lib/memberships/billing-server-action-runtime.ts', 'utf8')
  const start = source.indexOf('const h2Dependencies: BillingCoachActionDependencies = {')
  assert.ok(start >= 0, 'billing action dependency must exist')
  const end = source.indexOf('\n  function bulkMaterializationDependencies()', start)
  assert.ok(end > start)
  const dependencies = source.slice(start, end)
  assert.match(dependencies, /transaction:\s*\(operation\)\s*=>\s*transaction\(\(\)\s*=>/, 'economic exception transaction must invoke SQLite transaction wrapper')
  assert.doesNotMatch(dependencies, /transaction:\s*\(operation\)\s*=>\s*\n?\s*operation\(/, 'transaction must not directly invoke operation without a DB transaction')
})
