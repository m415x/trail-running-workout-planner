import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync('features/race-registration/components/CourseRegistration.tsx', 'utf8')
const data = readFileSync('lib/competitions/race-registration-course-data.ts', 'utf8')

describe('KAN-366 course-first explicit course change', () => {
  it('keeps the existing registration identity available for athletes registered elsewhere', () => {
    assert.match(data, /registrationId:\s*string/)
    assert.match(data, /registrationId:\s*registration\.registrationId/)
  })

  it('offers an explicit change-course action instead of treating the athlete as bulk-registerable', () => {
    assert.match(component, /changeRaceRegistrationCourseAction/)
    assert.match(component, /interaction\.registeredElsewhere\.map/)
    assert.match(component, /name=['"]registrationId['"]/)
    assert.match(component, /name=['"]raceCourseId['"]/)
    assert.match(component, /value=\{course\.id\}/)
    const elsewhereBlock = component.match(/\{interaction\.registeredElsewhere\.map\(\(athlete\) => \([\s\S]*?\n        \)\)\}/)?.[0] ?? ''
    assert.doesNotMatch(elsewhereBlock, /name=['"]athleteProfileId['"]/)
  })
})
