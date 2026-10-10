import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 terms Server Action forwards H2 author into initial and changed terms runtime', () => {
  const source = readFileSync('app/actions/membership-actions.ts', 'utf8')
  assert.match(source, /initializeTerms:\s*\(teamId, athleteId, effectiveFrom, authorship\)\s*=>/)
  assert.match(source, /runtime\.applyInitialAthleteBillingTerms\(\{\s*teamId, athleteId, effectiveFrom, authorship\s*\}\)/)
  assert.match(source, /changeTerms:\s*\(teamId, athleteId, input, authorship\)\s*=>/)
  assert.match(source, /runtime\.changeAthleteBillingTerms\(\{\s*teamId, athleteId, \.\.\.input, authorship\s*\}\)/)
})
