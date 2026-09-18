import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')
const actions = readFileSync('app/actions/race-registration-actions.ts', 'utf8')
const form = readFileSync('features/race-registration/components/AthleteRaceRegistrationForm.tsx', 'utf8')

describe('KAN-366 Coach athlete-first registration management', () => {
  it('creates an effective registration for the current athlete from an explicit edition and course', () => {
    assert.match(actions, /registerAthleteForRaceCourseAction/)
    assert.match(actions, /CURRENT_TEAM_ID/)
    assert.match(actions, /athleteProfileId/)
    assert.match(actions, /raceCourseId/)
    assert.match(actions, /findRaceRegistrationInEdition/)
    assert.match(actions, /createRaceRegistration/)
  })

  it('integrates registration management into the existing Coach athlete competition context', () => {
    assert.match(page, /AthleteRaceRegistrationForm/)
    assert.match(page, /listRaceEvents/)
    assert.match(page, /listRaceEditions/)
    assert.match(page, /listRaceCourses/)
    assert.match(form, /name=['"]raceEditionId['"]/)
    assert.match(form, /name=['"]raceCourseId['"]/)
    assert.match(form, /name=['"]athleteProfileId['"]/)
    assert.doesNotMatch(page, /registerAthletesForRaceCourse/)
  })
})
