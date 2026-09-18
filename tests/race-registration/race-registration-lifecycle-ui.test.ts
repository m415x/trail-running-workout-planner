import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const edition = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')
const lifecycle = readFileSync('features/race-registration/components/RaceRegistrationLifecycleControl.tsx', 'utf8')
const courseChange = readFileSync('features/race-registration/components/RaceRegistrationCourseChange.tsx', 'utf8')
const page = readFileSync('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx', 'utf8')

describe('KAN-366 Coach registration lifecycle UI', () => {
  it('wires explicit cancel/reactivate controls for effective edition registrations', () => {
    assert.match(edition, /RaceRegistrationLifecycleControl/)
    assert.match(edition, /registrationStatus=\{registration\.registrationStatus\}/)
    assert.match(lifecycle, /updateRaceRegistrationLifecycleFormAction/)
    assert.match(lifecycle, /name=['"]registrationStatus['"] value=['"]cancelled['"]/)
    assert.match(lifecycle, /name=['"]registrationStatus['"] value=['"]registered['"]/)
    assert.match(lifecycle, /ConfirmActionDialog/)
  })

  it('offers explicit same-edition course changes without treating a second registration as the change', () => {
    assert.match(courseChange, /changeRaceRegistrationCourseFormAction/)
    assert.match(courseChange, /name=['"]raceCourseId['"]/)
    assert.match(edition, /availableCourses/)
    assert.match(page, /availableCourses=\{courses\}/)
    assert.doesNotMatch(edition, /registerAthletesForRaceCourse/)
  })
})
