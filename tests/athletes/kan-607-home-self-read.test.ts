import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
const home = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')

function functionBody(name: string, next: string): string {
  const start = actions.indexOf(`export async function ${name}(`)
  const end = actions.indexOf(`export async function ${next}(`, start)
  assert.ok(start >= 0 && end > start, `Cannot locate ${name}`)
  return actions.slice(start, end)
}

test('KAN-698 Home never identifies an authenticated athlete using fixed EPT User / AthleteProfile IDs', () => {
  assert.doesNotMatch(actions, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID/)
  const read = functionBody('getCurrentAthlete', 'getWeeklySchedule')
  assert.match(read, /requireAuthenticatedEptAction/)
  assert.match(read, /createH5aSelfNextServerContext|createH5aSelfContextBoundary/)
  assert.doesNotMatch(read, /eq\(users\.id,\s*['"]user_1['"]\)/)
})

test('KAN-698 Home obtains only server-scoped athlete data before projecting schedule or realized evidence', () => {
  assert.match(home, /getCurrentAthlete\(/)
  assert.match(home, /getCurrentAthletePlanningWeek\(/)
  assert.match(home, /getCurrentAthleteRealizedTrainingRangeAction\(/)
  assert.doesNotMatch(home, /team_1|profile_user_1|CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID/)
})

test('KAN-698 no-profile and unauthorized Home states must not silently project a sample athlete', () => {
  const read = functionBody('getCurrentAthlete', 'getWeeklySchedule')
  assert.doesNotMatch(read, /findFirst\(\{[\s\S]*?CURRENT_USER_ID/)
  assert.match(read, /forbidden|denied|not_found|no_profile/)
})
