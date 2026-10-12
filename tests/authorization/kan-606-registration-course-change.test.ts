import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T6 course change requires H3 competition.manage and no fixed team', () => {
  const start = source.indexOf('export async function changeRaceRegistrationCourseAction(')
  const end = source.indexOf('export async function updateRaceRegistrationLifecycleAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'competition.manage'")
  assert.ok(capability >= 0, 'Course change must authorize competition.manage')
  assert.ok(capability < action.indexOf('applyRaceRegistrationCourseChange('), 'DENY must precede mutation')
  assert.equal(action.includes('CURRENT_TEAM_ID'), false, 'Team identity must not be a fixed fixture')
})
