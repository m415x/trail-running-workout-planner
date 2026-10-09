import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-700 server session evidence composes H2/SELF authority with persisted planning inputs', () => {
  const source = readFileSync('lib/athlete-planning/effective-self-session-next-server.ts', 'utf8')
  assert.match(source, /createH5aSelfNextServerContext/)
  assert.match(source, /createH5aEffectiveSessionBoundary/)
  assert.match(source, /athleteProfiles/)
  assert.match(source, /sessions/)
  assert.match(source, /groupSessionPrescriptions/)
  assert.match(source, /groupHistoryRecords/)
  assert.match(source, /planningCohortMemberships/)
  assert.match(source, /groupTrainingPlans/)
  assert.match(source, /microcycles/)
  assert.match(source, /mesocycles/)
  assert.match(source, /macrocycles/)
  assert.doesNotMatch(source, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID|profile_user_1|team_1/)
})

test('KAN-700 persisted lookup ties session locator to SELF profile and selected plan prescription', () => {
  const source = readFileSync('lib/athlete-planning/effective-self-session-next-server.ts', 'utf8')
  assert.match(source, /self\.athleteProfileId/)
  assert.match(source, /self\.teamId/)
  assert.match(source, /sessionId/)
  assert.match(source, /groupTrainingPlanId/)
  assert.match(source, /resolveEffectiveSelfSession|createH5aEffectiveSessionBoundary/)
})
