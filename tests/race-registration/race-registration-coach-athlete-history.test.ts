import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')
const repository = readFileSync('lib/competitions/race-registration-repository.ts', 'utf8')
const application = readFileSync('lib/competitions/race-registration-application.ts', 'utf8')

describe('Coach athlete factual race history', () => {
  it('loads team-and-athlete-scoped registrations in the existing athlete detail context', () => {
    assert.match(repository, /listRaceRegistrationsForAthlete/)
    assert.match(repository, /eq\(raceRegistrations\.teamId, input\.teamId\)/)
    assert.match(repository, /eq\(raceRegistrations\.athleteProfileId, input\.athleteProfileId\)/)
    assert.match(page, /listRaceRegistrationsForAthlete/)
    assert.match(page, /athleteProfileId:\s*athleteId/)
    assert.match(page, /projectAthleteRaceCompetition/)
  })

  it('keeps effective registrations separate from factual participation history without treating nominal distance as performed distance', () => {
    assert.match(page, /upcomingRegistrations/)
    assert.match(page, /history/)
    assert.match(page, /participationStatus/)
    assert.match(page, /actualDistanceKm/)
    assert.match(page, /elapsedTimeSeconds/)
    assert.match(application, /registrationStatus === 'registered'/)
    assert.match(application, /actualDistanceKm: registration\.result\?\.actualDistanceKm \?\? null/)
    assert.doesNotMatch(page, /readiness|fitness|authorization|ranking|position/i)
  })
})
