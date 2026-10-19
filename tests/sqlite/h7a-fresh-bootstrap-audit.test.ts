import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const scenarios = readFileSync('scripts/verify-sqlite-scenarios.ts', 'utf8')
const verifier = readFileSync('scripts/verify-sqlite.ts', 'utf8')

test('KAN-776/S4 fresh SQLite canonical bootstrap invokes H7A physical and metadata audit before disposable cleanup', () => {
  const start = scenarios.indexOf('function runEmptyBootstrapScenario(')
  const end = scenarios.indexOf('export async function runFullSeedScenario(', start)
  assert.ok(start >= 0 && end > start)
  const body = scenarios.slice(start, end)
  assert.match(body, /upgrade-sqlite\.ts/)
  assert.match(body, /verify-sqlite\.ts/)
  assert.match(body, /verify-h7a-sqlite\.ts/)
  assert.ok(body.indexOf('verify-h7a-sqlite.ts') < body.indexOf('removeScenarioWorkspace(workspace)'))
})

test('KAN-776/S4 normal SQLite verifier enforces physical H7A contract rather than table presence only', () => {
  assert.match(verifier, /auditH7aPhysicalSchema/)
  assert.match(verifier, /inspectH7aMigrationGuard/)
})
