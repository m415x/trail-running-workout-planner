import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const statsPage = readFileSync('app/[locale]/(mobile)/stats/competition/page.tsx', 'utf8')
const planPage = readFileSync('app/[locale]/(mobile)/plan/competition/page.tsx', 'utf8')

describe('Athlete competition registration surfaces', () => {
  it('keeps Stats Competition historical and factual', () => {
    assert.match(statsPage, /getCurrentAthleteRaceRegistrationsAction/)
    assert.match(statsPage, /raceRegistrationData\.history/)
    assert.doesNotMatch(statsPage, /raceRegistrationData\.upcoming/)
    assert.doesNotMatch(statsPage, /primaryCompetition|intermediateCompetitions/)
    assert.match(statsPage, /actualDistanceKm/)
    assert.match(statsPage, /elapsedTimeSeconds/)
    assert.doesNotMatch(statsPage, /ranking|position|readiness|performance prediction/i)
  })

  it('surfaces effective upcoming registrations under Plan Competition', () => {
    assert.match(planPage, /getCurrentAthleteRaceRegistrationsAction/)
    assert.match(planPage, /result\.data\.upcoming/)
    assert.match(planPage, /eventName/)
    assert.match(planPage, /editionLabel/)
    assert.match(planPage, /courseLabel/)
    assert.match(planPage, /nominalDistanceKm/)
    assert.match(planPage, /nominalElevationGainM/)
    assert.doesNotMatch(planPage, /actualDistanceKm|elapsedTimeSeconds|ranking|readiness/i)
  })
})
