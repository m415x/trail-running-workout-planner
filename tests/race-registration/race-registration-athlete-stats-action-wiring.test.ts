import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const actions = readFileSync('app/actions/athlete-stats-actions.ts', 'utf8')

describe('athlete Stats race registration action wiring', () => {
  it('resolves the current athlete server-side before loading race registrations', () => {
    assert.match(actions, /export async function getCurrentAthleteRaceRegistrationsAction/)
    assert.match(actions, /getCurrentAthlete\(\)/)
    assert.match(actions, /loadAthleteRaceRegistrations/)
    assert.match(actions, /athleteId/)
    assert.match(actions, /teamId/)
  })

  it('accepts only presentation time context and never athlete or team identity from the client', () => {
    assert.match(actions, /today:\s*string/)
    assert.doesNotMatch(actions, /getCurrentAthleteRaceRegistrationsAction\([^)]*athleteId/)
    assert.doesNotMatch(actions, /getCurrentAthleteRaceRegistrationsAction\([^)]*teamId/)
  })
})
