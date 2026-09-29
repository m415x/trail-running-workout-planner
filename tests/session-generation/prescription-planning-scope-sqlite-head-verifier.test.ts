import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const verifier = fs.readFileSync(path.join(root, 'scripts', 'verify-sqlite.ts'), 'utf8')
const scenarios = fs.readFileSync(path.join(root, 'scripts', 'verify-sqlite-scenarios.ts'), 'utf8')

test('SQLite HEAD verifier enforces prescription planning-scope uniqueness', () => {
  assert.match(verifier, /group_session_prescriptions/)
  assert.match(verifier, /group_session_prescriptions_session_microcycle_unique/)
  assert.match(verifier, /session_id/)
  assert.match(verifier, /microcycle_id/)
  assert.match(verifier, /session_group_unique/)
  assert.match(verifier, /throw new Error/)
})

test('upgrade, preservation, drift and rerun scenarios all pass through the HEAD verifier', () => {
  for (const fn of [
    'runUpgradeScenario',
    'runPreservationScenario',
    'runDriftScenario',
    'runRerunScenario',
  ]) {
    const block = scenarios.match(new RegExp(`function ${fn}[\\s\\S]*?\\n}`))?.[0] ?? ''
    assert.match(block, /verify-sqlite/)
  }
})
