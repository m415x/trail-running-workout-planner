import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const verifier = fs.readFileSync(
  path.join(process.cwd(), 'scripts', 'verify-sqlite-scenarios.ts'),
  'utf8',
)

test('SQLite preservation scenario keeps a representative session prescription across planning-scope migration', () => {
  const scenario = verifier.match(/function runPreservationScenario[\s\S]*?\n}/)?.[0] ?? ''

  assert.match(scenario, /preservation-group/)
  assert.match(scenario, /preservation-plan/)
  assert.match(scenario, /preservation-macrocycle/)
  assert.match(scenario, /preservation-mesocycle/)
  assert.match(scenario, /preservation-microcycle/)
  assert.match(scenario, /preservation-session/)
  assert.match(scenario, /preservation-prescription/)
  assert.match(scenario, /group_session_prescriptions/)
  assert.match(scenario, /generation_ownership/)
  assert.match(scenario, /generation_key/)
  assert.match(scenario, /SELECT[\s\S]*session_id[\s\S]*group_id[\s\S]*microcycle_id[\s\S]*FROM group_session_prescriptions/i)
  assert.match(scenario, /group_session_prescriptions_session_microcycle_unique/)
})
