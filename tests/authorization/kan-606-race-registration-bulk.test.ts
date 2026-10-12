import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T5 bulk race registration enforces competition.manage before execution', () => {
  const start = source.indexOf('export async function registerAthletesForRaceCourse(')
  const end = source.indexOf('export async function changeRaceRegistrationCourseAction(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const capability = action.indexOf("'competition.manage'")
  assert.ok(capability >= 0, 'Bulk registration requires H3 competition authority')
  assert.ok(capability < action.indexOf('executeRaceRegistrationServerAction('))
  assert.equal(action.includes('CURRENT_TEAM_ID'), false)
})
