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
    assert.match(component, /Inscripto en este recorrido/)
    assert.match(component, /Inscripto en .*courseLabel/)
  })

  it('submits selected athletes through the existing race registration action boundary', () => {
    assert.match(component, /raceRegistrationAction/)
    assert.match(component, /<form[^>]+action=/)
    assert.match(component, /name='courseId'/)
    assert.match(component, /value=\{course\.id\}/)
    assert.match(component, /name='locale'/)
    assert.match(component, /type='submit'/)
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
})
