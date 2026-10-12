import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T7 participation update requires H3 competition.manage and persisted Team', () => {
  const start = source.indexOf('export async function updateRaceParticipationAction(')
  const end = source.indexOf('/** Form-compatible adapters', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'competition.manage'")
  assert.ok(capability >= 0, 'Participation updates require explicit H3 competition authority')
  assert.ok(capability < action.indexOf('updateRaceParticipation('), 'H3 DENY must precede any mutation')
  assert.equal(action.includes('CURRENT_TEAM_ID'), false, 'Team must be resolved from persisted registration')
})
