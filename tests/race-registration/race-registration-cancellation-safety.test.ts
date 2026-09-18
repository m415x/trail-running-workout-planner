import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const edition = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')
const lifecycle = readFileSync('features/race-registration/components/RaceRegistrationLifecycleControl.tsx', 'utf8')
const en = JSON.parse(readFileSync('messages/en/competitions/race-catalog.json', 'utf8'))
const es = JSON.parse(readFileSync('messages/es/competitions/race-catalog.json', 'utf8'))

test('registration cancellation uses a client boundary with shared destructive confirmation before lifecycle mutation', () => {
  assert.match(edition, /RaceRegistrationLifecycleControl/)
  assert.match(lifecycle, /^['"]use client['"]/)
  assert.match(lifecycle, /ConfirmActionDialog/)
  assert.match(lifecycle, /variant=['"]destructive['"]/)
  assert.match(lifecycle, /onConfirm/)
  assert.match(lifecycle, /requestSubmit/)
  assert.match(lifecycle, /updateRaceRegistrationLifecycleFormAction/)
})

test('registration reactivation remains a direct lower-risk lifecycle action', () => {
  assert.match(lifecycle, /reactivateRegistration/)
  assert.match(lifecycle, /name=['"]registrationStatus['"] value=['"]registered['"]/)
})

test('cancellation confirmation copy exists in English and Spanish', () => {
  for (const messages of [en, es]) {
    const registrations = messages.RaceCatalog.registrations
    assert.ok(registrations.cancelConfirmTitle)
    assert.ok(registrations.cancelConfirmDescription)
    assert.ok(registrations.cancelConfirmAction)
    assert.ok(registrations.cancelConfirmKeep)
  }
})
