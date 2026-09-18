import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirtyFormRegistration } from '../../lib/forms/dirty-form-registration'

test('an unregistered dashboard guard is clean', () => {
  const registration = createDirtyFormRegistration()
  assert.equal(registration.isDirty(), false)
})

test('registered values become dirty and can return to the baseline', () => {
  const registration = createDirtyFormRegistration()

  registration.register({ name: 'Ana' })
  registration.update({ name: 'Anita' })
  assert.equal(registration.isDirty(), true)

  registration.update({ name: 'Ana' })
  assert.equal(registration.isDirty(), false)
})

test('markSaved establishes the current registered value as the new baseline', () => {
  const registration = createDirtyFormRegistration()

  registration.register({ name: 'Ana' })
  registration.update({ name: 'Anita' })
  registration.markSaved()

  assert.equal(registration.isDirty(), false)
})

test('unregister removes protection from the dashboard shell', () => {
  const registration = createDirtyFormRegistration()

  registration.register({ name: 'Ana' })
  registration.update({ name: 'Anita' })
  registration.unregister()

  assert.equal(registration.isDirty(), false)
})
