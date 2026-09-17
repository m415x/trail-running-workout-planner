import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const page = readFileSync('app/[locale]/dashboard/competitions/[[...segments]]/page.tsx', 'utf8')

describe('race course registration page data contract', () => {
  it('loads course registration data and passes it to the registration surface', () => {
    assert.match(page, /loadCourseRegistrationData/)
    assert.match(page, /listActiveCourseRegistrationAthletes/)
    assert.match(page, /listEffectiveCourseRegistrationsInEdition/)
    assert.match(page, /<CourseRegistration[\s\S]*interaction=/)
  })
})
