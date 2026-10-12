import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T6 registration lifecycle requires H3 competition.manage on persisted Team', () => {
  const start = source.indexOf('export async function updateRaceRegistrationLifecycleAction(')
  const end = source.indexOf('export async function updateRaceParticipationAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'competition.manage'")
  assert.ok(capability >= 0, 'Lifecycle change must require competition.manage')
  assert.ok(capability < action.indexOf('applyRaceRegistrationLifecycle('), 'DENY must precede mutation')
  assert.equal(action.includes('CURRENT_TEAM_ID'), false)
})
