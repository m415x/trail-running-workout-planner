import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const edition = readFileSync('features/race-registration/components/EditionRegistrations.tsx', 'utf8')
const en = JSON.parse(readFileSync('messages/en/competitions/race-catalog.json', 'utf8'))
const es = JSON.parse(readFileSync('messages/es/competitions/race-catalog.json', 'utf8'))

test('registration cancellation uses the shared destructive confirmation before lifecycle mutation', () => {
  assert.match(edition, /ConfirmActionDialog/)
  assert.match(edition, /variant=['"]destructive['"]/)
  assert.match(edition, /onConfirm/)
  assert.match(edition, /updateRaceRegistrationLifecycleFormAction/)
})

test('registration reactivation remains a direct lower-risk lifecycle action', () => {
  assert.match(edition, /reactivateRegistration/)
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
