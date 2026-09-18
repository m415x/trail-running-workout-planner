import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirtyFormGuardController } from '../../lib/forms/dirty-form-guard-controller'

test('controller derives dirty state from the current value and resettable baseline', () => {
  let current = { name: 'Ana' }
  const guard = createDirtyFormGuardController(current, () => current)

  assert.equal(guard.isDirty(), false)

  current = { name: 'Ana María' }
  assert.equal(guard.isDirty(), true)

  current = { name: 'Ana' }
  assert.equal(guard.isDirty(), false)
})

test('markSaved establishes the current value as the new safe baseline', () => {
  let current = { name: 'Ana' }
  const guard = createDirtyFormGuardController(current, () => current)

  current = { name: 'Ana María' }
  assert.equal(guard.isDirty(), true)

  guard.markSaved()
  assert.equal(guard.isDirty(), false)

  current = { name: 'Ana' }
  assert.equal(guard.isDirty(), true)
})

test('guardNavigation exposes pending state until stay or discard resolves it', () => {
  let current = { name: 'Ana María' }
  let navigations = 0
  const guard = createDirtyFormGuardController({ name: 'Ana' }, () => current)

  guard.guardNavigation(() => {
    navigations += 1
  })

  assert.equal(guard.hasPendingNavigation(), true)
  assert.equal(navigations, 0)

  guard.stay()
  assert.equal(guard.hasPendingNavigation(), false)
  assert.equal(navigations, 0)

  guard.guardNavigation(() => {
    navigations += 1
  })
  guard.discard()

  assert.equal(guard.hasPendingNavigation(), false)
  assert.equal(navigations, 1)
})
