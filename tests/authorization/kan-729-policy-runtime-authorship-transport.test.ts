import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy Server Action forwards verified author into runtime boundary', () => {
  const source = readFileSync('app/actions/membership-actions.ts', 'utf8')
  assert.match(source, /configure:\s*\(teamId, input, authorship\)\s*=>/)
  assert.match(source, /runtime\.configureTeamEconomicPolicy\(\{\s*\.\.\.input,\s*teamId,\s*authorship\s*\}\)/)
  assert.doesNotMatch(source, /configure:\s*\(teamId, input\)\s*=>/)
})
