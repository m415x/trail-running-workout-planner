import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const edition = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')
const page = readFileSync('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx', 'utf8')

describe('KAN-366 Coach registration lifecycle UI', () => {
  it('wires explicit cancel/reactivate controls for effective edition registrations', () => {
    assert.match(edition, /updateRaceRegistrationLifecycleAction/)
    assert.match(edition, /name=['"]registrationStatus['"]/)
    assert.match(edition, /value=['"]cancelled['"]/)
    assert.match(edition, /value=['"]registered['"]/)
    assert.match(edition, /registration\.registrationStatus/)
  })

  it('offers explicit same-edition course changes without treating a second registration as the change', () => {
    assert.match(edition, /changeRaceRegistrationCourseAction/)
    assert.match(edition, /name=['"]raceCourseId['"]/)
    assert.match(edition, /availableCourses/)
    assert.match(page, /availableCourses=\{courses\}/)
    assert.doesNotMatch(edition, /registerAthletesForRaceCourse/)
  })
})
