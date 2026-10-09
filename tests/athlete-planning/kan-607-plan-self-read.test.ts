import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const actions = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
const start = actions.indexOf('export async function getCurrentAthletePlanningWeek(')
const end = actions.indexOf('export async function getAthleteShoes(', start)
assert.ok(start >= 0 && end > start)
const planning = actions.slice(start, end)

test('KAN-699 Athlete effective planning requires an explicit server-side planning.self.read boundary', () => {
  assert.match(planning, /createH5aSelfNextServerContext/)
  assert.match(planning, /capability:\s*['"]planning\.self\.read['"]/)
  assert.doesNotMatch(planning, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID|team_1|profile_user_1/)
})

test('KAN-699 planning week never treats failed SELF authorization as an empty valid calendar', () => {
  assert.match(planning, /success:\s*false/)
  assert.match(planning, /status:\s*['\"]unauthorized['\"]/)
  assert.match(planning, /athlete\.teamId/)
  assert.match(planning, /athlete\.id/)
})

test('KAN-699 effective calendar continues to use persisted group history and cohort/variant resolution', () => {
  assert.match(planning, /groupHistoryRecords/)
  assert.match(planning, /planningCohortMemberships/)
  assert.match(planning, /groupTrainingPlans/)
  assert.match(planning, /resolveAthletePlanningOnDate/)
  assert.match(planning, /resolveAthleteSessionPrescription/)
  assert.match(planning, /resolveAthletePlanningSession/)
})
