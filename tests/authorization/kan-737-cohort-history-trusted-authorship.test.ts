import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-737 cohort membership assign/close derive historic author from canonical H2/H3 context', () => {
  const source = readFileSync('app/actions/planning-cohort-actions.ts', 'utf8')
  assert.match(source, /resolveTrustedH7aAuthorship/)
  assert.match(source, /assignedByUserId:\s*authorship\.effectiveActorUserId/)
  assert.match(source, /endedByUserId:\s*authorship\.effectiveActorUserId/)
  assert.doesNotMatch(source, /assignedByUserId:\s*planningContext\.access\.userId/)
  assert.doesNotMatch(source, /endedByUserId:\s*planningContext\.access\.userId/)
})
