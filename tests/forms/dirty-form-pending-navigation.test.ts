import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPendingNavigation,
  resolvePendingNavigation,
} from '../../lib/forms/dirty-form-navigation'

test('dirty navigation stores a continuation without running it immediately', () => {
  let navigations = 0
  const pending = createPendingNavigation(true, () => {
    navigations += 1
  })

  assert.equal(pending.effect.type, 'confirm-discard')
  assert.equal(navigations, 0)
  assert.equal(pending.continueNavigation instanceof Function, true)
})

test('clean navigation runs immediately and does not keep a pending continuation', () => {
  let navigations = 0
  const pending = createPendingNavigation(false, () => {
    navigations += 1
  })

  assert.equal(pending.effect.type, 'navigate')
  assert.equal(navigations, 1)
  assert.equal(pending.continueNavigation, null)
})

test('staying discards the pending continuation while confirming runs it once', () => {
  let navigations = 0
  const pending = createPendingNavigation(true, () => {
    navigations += 1
  })

  assert.equal(resolvePendingNavigation(pending.continueNavigation, 'stay'), null)
  assert.equal(navigations, 0)

  const second = createPendingNavigation(true, () => {
    navigations += 1
  })

  assert.equal(resolvePendingNavigation(second.continueNavigation, 'discard'), null)
  assert.equal(navigations, 1)
})
