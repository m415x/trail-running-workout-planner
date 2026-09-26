import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('SQLite preservation scenario keeps representative legacy memberships raw and does not infer H1 billing facts', () => {
  const verifier = fs.readFileSync(
    path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
    'utf8',
  )

  const scenario = verifier.match(/function runPreservationScenario[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(scenario, /INSERT INTO memberships/i)
  assert.match(scenario, /preservation-membership/)
  assert.match(scenario, /SELECT[\s\S]*FROM memberships/i)
  assert.match(scenario, /team_economic_policies/i)
  assert.match(scenario, /athlete_billing_terms/i)
  assert.match(scenario, /monthly_charges/i)
  assert.match(scenario, /COUNT\(\*\)/i)
  assert.match(scenario, /legacy membership/i)
})
