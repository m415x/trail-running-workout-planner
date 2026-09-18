import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync('features/race-registration/components/RaceRegistrationCourseChange.tsx', 'utf8')
const en = JSON.parse(readFileSync('messages/en/competitions/race-catalog.json', 'utf8'))
const es = JSON.parse(readFileSync('messages/es/competitions/race-catalog.json', 'utf8'))

test('course change uses the shared contextual confirmation before mutation', () => {
  assert.match(component, /ConfirmActionDialog/)
  assert.match(component, /variant=['"]primary['"]/)
  assert.match(component, /onConfirm/)
  assert.match(component, /requestSubmit/)
  assert.match(component, /changeRaceRegistrationCourseFormAction/)
})

test('course selection alone remains local until the confirmed action', () => {
  assert.match(component, /onChange=\{\(event\) => setRaceCourseId\(event\.target\.value\)\}/)
  assert.match(component, /raceCourseId !== currentRaceCourseId/)
})

test('course-change confirmation copy exists in English and Spanish', () => {
  for (const messages of [en, es]) {
    const registrations = messages.RaceCatalog.registrations
    assert.ok(registrations.changeCourseConfirmTitle)
    assert.ok(registrations.changeCourseConfirmDescription)
    assert.ok(registrations.changeCourseConfirmAction)
    assert.ok(registrations.changeCourseConfirmKeep)
  }
})
