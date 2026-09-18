import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const application = readFileSync('lib/competitions/race-registration-application.ts', 'utf8')
const repository = readFileSync('lib/competitions/race-registration-repository.ts', 'utf8')
const component = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')

describe('RaceEdition registration athlete names', () => {
  it('resolves a display name from the team-scoped edition registration source without replacing historical registration identity', () => {
    assert.match(repository, /listRaceRegistrationsInEdition/)
    assert.match(repository, /athleteProfiles/)
    assert.match(repository, /users/)
    assert.match(repository, /athleteName/)
    assert.match(application, /athleteProfileId/)
    assert.match(application, /athleteName/)
  })

  it('renders the usable athlete name with an id fallback instead of exposing only the raw profile id', () => {
    assert.match(component, /registration\.athleteName/)
    assert.match(component, /registration\.athleteProfileId/)
    assert.match(component, /registration\.athleteName \?\? registration\.athleteProfileId/)
    assert.doesNotMatch(component, /<span className='font-medium'>\{registration\.athleteProfileId\}<\/span>/)
  })
})
