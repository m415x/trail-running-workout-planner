import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync(
  'app/[locale]/dashboard/competitions/[[...segments]]/page.tsx',
  'utf8',
)

describe('coach RaceEdition registration surface', () => {
  it('loads effective edition registrations and projects them by course', () => {
    assert.match(page, /listEffectiveCourseRegistrationsInEdition\(/)
    assert.match(page, /projectRaceEditionRegistrations\(/)
    assert.match(page, /editionRegistrationGroups/)
  })

  it('renders registered athletes grouped by course without inferring result facts', () => {
    assert.match(page, /editionRegistrationGroups\.map/)
    assert.match(page, /group\.courseLabel/)
    assert.match(page, /group\.registrations\.map/)
    assert.match(page, /registration\.athleteProfileId/)
    assert.match(page, /registration\.participationStatus/)
    assert.match(page, /registration\.actualDistanceKm/)
  })
})
