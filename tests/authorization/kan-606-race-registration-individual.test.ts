import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync('app/actions/race-registration-actions.ts', 'utf8')

test('KAN-606 T5 individual registration requires Coach competition capability', () => {
  const start = source.indexOf('export async function registerAthleteForRaceCourseAction(')
  const end = source.indexOf('export async function registerAthletesForRaceCourse(', start)
  assert.ok(start >= 0 && end > start)
  const action = source.slice(start, end)
  const gate = action.indexOf("'competition.manage'")
  assert.ok(gate >= 0, 'Explicit competition capability is required')
  assert.ok(gate < action.indexOf('runBulkRaceRegistrationAction('))
  assert.equal(action.includes('CURRENT_TEAM_ID'), false)
})
