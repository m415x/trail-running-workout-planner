import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const scenarios = readFileSync('scripts/verify-sqlite-scenarios.ts', 'utf8')
const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }

test('KAN-777/S5 disposable canonical rerun validates H7A after the second pass', () => {
  const start = scenarios.indexOf('function runRerunScenario(')
  const end = scenarios.indexOf('\nexport ', start + 1)
  assert.ok(start >= 0)
  const source = scenarios.slice(start, end > start ? end : undefined)
  assert.match(source, /upgrade-sqlite\.ts/)
  assert.match(source, /verify-h7a-sqlite\.ts/)
})

test('KAN-777/S5 retains officially supported historical SQLite scenarios', () => {
  for (const value of ['upgrade', 'preservation', 'drift', 'rerun']) {
    assert.match(packageJson.scripts['db:sqlite:check'], new RegExp('verify-sqlite-scenarios\\.ts ' + value))
  }
})
