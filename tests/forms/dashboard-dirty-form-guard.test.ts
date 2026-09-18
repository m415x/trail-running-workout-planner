import assert from 'node:assert/strict'
import test from 'node:test'
import { createDashboardDirtyFormGuard } from '../../lib/forms/dashboard-dirty-form-guard'

test('dashboard navigation proceeds when no dirty form is registered', () => {
  const guard = createDashboardDirtyFormGuard()
  let navigated = false

  guard.guardNavigation(() => {
    navigated = true
  })

  assert.equal(navigated, true)
  assert.equal(guard.hasPendingNavigation(), false)
})

test('dashboard navigation waits for discard when the registered form is dirty', () => {
  const guard = createDashboardDirtyFormGuard()
  let navigated = false

  guard.register({ name: 'Ana' })
  guard.update({ name: 'Anita' })
  guard.guardNavigation(() => {
    navigated = true
  })

  assert.equal(navigated, false)
  assert.equal(guard.hasPendingNavigation(), true)

  guard.discard()

  assert.equal(navigated, true)
  assert.equal(guard.hasPendingNavigation(), false)
})

test('staying cancels the pending dashboard navigation', () => {
  const guard = createDashboardDirtyFormGuard()
  let navigated = false

  guard.register({ name: 'Ana' })
  guard.update({ name: 'Anita' })
  guard.guardNavigation(() => {
    navigated = true
  })
  guard.stay()

  assert.equal(navigated, false)
  assert.equal(guard.hasPendingNavigation(), false)
})
