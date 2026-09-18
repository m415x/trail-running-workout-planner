import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync(
  'app/[locale]/(mobile)/stats/competition/page.tsx',
  'utf8',
)

describe('Athlete Stats Competition race registration surface', () => {
  it('loads the athlete-safe registration projection alongside existing competition planning context', () => {
    assert.match(page, /getCurrentAthleteRaceRegistrationsAction/)
    assert.match(page, /today/)
    assert.match(page, /raceRegistrationData\.upcoming/)
    assert.match(page, /raceRegistrationData\.history/)
    assert.match(page, /primaryCompetition/)
  })

  it('renders factual upcoming and historical race fields without ranking or interpretation', () => {
    assert.match(page, /eventName/)
    assert.match(page, /editionLabel/)
    assert.match(page, /courseLabel/)
    assert.match(page, /nominalDistanceKm/)
    assert.match(page, /nominalElevationGainM/)
    assert.match(page, /participationStatus/)
    assert.match(page, /actualDistanceKm/)
    assert.match(page, /elapsedTimeSeconds/)
    assert.doesNotMatch(page, /ranking|position|readiness|performance prediction/i)
  })
})
