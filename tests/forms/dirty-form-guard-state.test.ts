import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createDirtyFormGuardState,
  requestGuardedNavigation,
  resolveGuardedNavigation,
} from '../../lib/forms/dirty-form-guard-state'

test('guard state starts without a pending navigation', () => {
  assert.deepEqual(createDirtyFormGuardState(), {
    pendingNavigation: null,
  })
})

test('clean navigation executes immediately and leaves no pending state', () => {
  let navigations = 0
  const state = createDirtyFormGuardState()

  const next = requestGuardedNavigation(state, false, () => {
    navigations += 1
  })

  assert.equal(navigations, 1)
  assert.equal(next.pendingNavigation, null)
})

test('dirty navigation stores one pending continuation until the user resolves it', () => {
  let navigations = 0
  const state = requestGuardedNavigation(createDirtyFormGuardState(), true, () => {
    navigations += 1
  })

  assert.equal(navigations, 0)
  assert.equal(state.pendingNavigation instanceof Function, true)

  const stayed = resolveGuardedNavigation(state, 'stay')
  assert.equal(stayed.pendingNavigation, null)
  assert.equal(navigations, 0)
})

test('discard runs the pending navigation and clears it', () => {
  let navigations = 0
  const state = requestGuardedNavigation(createDirtyFormGuardState(), true, () => {
    navigations += 1
  })

  const resolved = resolveGuardedNavigation(state, 'discard')

  assert.equal(navigations, 1)
  assert.equal(resolved.pendingNavigation, null)
})
