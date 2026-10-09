import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const planning = readFileSync('app/actions/dashboard-actions.ts', 'utf8')
const sessionLink = readFileSync('lib/realized-training/authoritative-session-link.ts', 'utf8')

test('KAN-700 a session locator is not authorization: a same-Team session must be effective for SELF', () => {
  // H5A requires a common server-side predicate reusable by an Athlete read
  // and later by session-linked manual capture. Team equality is insufficient.
  const effectiveSession = readFileSync('lib/athlete-planning/effective-self-session.ts', 'utf8')
  assert.match(effectiveSession, /resolveAthletePlanningOnDate/)
  assert.match(effectiveSession, /resolveAthleteSessionPrescription/)
  assert.match(effectiveSession, /athleteProfileId|athleteId/)
  assert.match(effectiveSession, /sessionId/)
  assert.match(effectiveSession, /prescriptionId/)
  assert.doesNotMatch(effectiveSession, /CURRENT_ATHLETE_PROFILE_ID|team_1|profile_user_1/)
})

test('KAN-700 weekly Athlete projection retains effective plan, selected prescription and individual adjustment', () => {
  assert.match(planning, /resolveAthletePlanningOnDate/)
  assert.match(planning, /resolveAthleteSessionPrescription/)
  assert.match(planning, /resolveAthletePlanningSession/)
  assert.match(planning, /athleteSessionAdjustmentRevisions/)
})

test('KAN-700 existing manual session link currently checks Team but cannot independently prove effective SELF', () => {
  assert.match(sessionLink, /teamId/)
  // The shared predicate introduced for T4 must supersede same-Team-only
  // acceptance where a session locator is presented by the Athlete.
  const effectiveSession = readFileSync('lib/athlete-planning/effective-self-session.ts', 'utf8')
  assert.match(effectiveSession, /effective|resolved/i)
})
