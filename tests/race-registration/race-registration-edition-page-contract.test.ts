import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  'features/race-registration/components/EditionRegistrations.tsx',
  'utf8',
)
const repository = readFileSync(
  'lib/competitions/race-registration-repository.ts',
  'utf8',
)

describe('coach RaceEdition registration surface', () => {
  it('provides team-scoped edition registration facts for projection', () => {
    assert.match(repository, /listRaceRegistrationsInEdition/)
    assert.match(repository, /eq\(raceRegistrations\.teamId, input\.teamId\)/)
    assert.match(repository, /eq\(raceRegistrations\.raceEditionId, input\.raceEditionId\)/)
    assert.match(repository, /\.map\(mapRegistration\)/)
  })

  it('renders registered athletes grouped by course without inferring result facts', () => {
    assert.match(component, /editionRegistrationGroups\.map/)
    assert.match(component, /group\.courseLabel/)
    assert.match(component, /group\.registrations\.map/)
    assert.match(component, /registration\.athleteProfileId/)
    assert.match(component, /registration\.participationStatus/)
    assert.match(component, /registration\.actualDistanceKm/)
  })
})
