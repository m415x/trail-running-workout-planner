import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const repository = readFileSync(
  'lib/competitions/race-registration-repository.ts',
  'utf8',
)
const source = readFileSync(
  'lib/athlete-stats/athlete-race-registration-source.ts',
  'utf8',
)

describe('athlete Stats race registration source', () => {
  it('loads registrations only through explicit team and athlete scope', () => {
    assert.match(repository, /export function listRaceRegistrationsForAthlete/)
    assert.match(repository, /eq\(raceRegistrations\.teamId, input\.teamId\)/)
    assert.match(repository, /eq\(raceRegistrations\.athleteProfileId, input\.athleteProfileId\)/)
    assert.match(source, /listRaceRegistrationsForAthlete/)
    assert.match(source, /teamId:\s*subject\.teamId/)
    assert.match(source, /athleteProfileId:\s*subject\.athleteId/)
  })

  it('projects the scoped persistence rows through the athlete-safe allowlist', () => {
    assert.match(source, /projectAthleteRaceRegistrations/)
    assert.match(source, /today/)
    assert.doesNotMatch(source, /CURRENT_TEAM_ID/)
  })
})
