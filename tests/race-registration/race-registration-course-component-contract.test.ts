import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const component = readFileSync(
  'features/race-registration/components/CourseRegistration.tsx',
  'utf8',
)

describe('course registration component contract', () => {
  it('renders eligible athletes as selectable and existing registrations as contextual rows', () => {
    assert.match(component, /interaction\.eligible\.map/)
    assert.match(component, /type='checkbox'/)
    assert.match(component, /name='athleteProfileId'/)
    assert.match(component, /interaction\.registeredHere\.map/)
    assert.match(component, /interaction\.registeredElsewhere\.map/)
    assert.match(component, /t\('registeredHere'\)/)
    assert.match(component, /t\('registeredElsewhere'/)
  })

  it('submits selected athletes through the existing race registration action boundary', () => {
    assert.match(component, /registerAthletesForRaceCourse/)
    assert.match(component, /<form[^>]+action=/)
    assert.match(component, /name='raceCourseId'/)
    assert.match(component, /value=\{course\.id\}/)
    assert.match(component, /name='locale'/)
    assert.match(component, /requestSubmit/)
  })

  it('requires Level 2 confirmation with concrete athletes and edition/course context before bulk execution', () => {
    assert.match(component, /ConfirmActionDialog/)
    assert.match(component, /selectedAthleteIds/)
    assert.match(component, /selectedAthletes/)
    assert.match(component, /athlete\.athleteName/)
    assert.match(component, /edition\.label/)
    assert.match(component, /course\.label/)
    assert.match(component, /requestSubmit/)
  })

  it('renders structured partial-success feedback from the race registration action result', () => {
    assert.match(component, /useActionState/)
    assert.match(component, /result\.requested/)
    assert.match(component, /result\.succeeded/)
    assert.match(component, /result\.failed/)
    assert.match(component, /result\.failures\.map/)
    assert.match(component, /failure\.athleteProfileId/)
    assert.match(component, /failure\.existingCourseLabel/)
  })
})
