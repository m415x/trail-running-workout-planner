import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const application = readFileSync('lib/competitions/race-registration-application.ts', 'utf8')
const page = readFileSync('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx', 'utf8')
const component = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')

describe('RaceEdition registration athlete names', () => {
  it('projects a display name from the team-scoped athlete roster without replacing historical registration identity', () => {
    assert.match(application, /athleteName/)
    assert.match(application, /athletes:/)
    assert.match(page, /listActiveCourseRegistrationAthletes/)
    assert.match(page, /projectRaceEditionRegistrations\([^)]*editionRegistrations[^)]*athletes/s)
  })

  it('renders the usable athlete name with an id fallback instead of exposing only the raw profile id', () => {
    assert.match(component, /registration\.athleteName/)
    assert.match(component, /registration\.athleteProfileId/)
    assert.doesNotMatch(component, /<span className='font-medium'>\{registration\.athleteProfileId\}<\/span>/)
  })
})
