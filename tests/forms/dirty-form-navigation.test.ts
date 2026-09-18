import assert from 'node:assert/strict'
import test from 'node:test'
import {
  beforeUnloadGuardEffect,
  guardedNavigationEffect,
} from '../../lib/forms/dirty-form-navigation'

test('clean navigation proceeds without opening a confirmation', () => {
  assert.deepEqual(guardedNavigationEffect(false), { type: 'navigate' })
})

test('dirty navigation is blocked until the user explicitly confirms discard', () => {
  assert.deepEqual(guardedNavigationEffect(true), { type: 'confirm-discard' })
})

test('beforeunload only prevents document exit for meaningful dirty state', () => {
  assert.deepEqual(beforeUnloadGuardEffect(false), { preventDefault: false })
  assert.deepEqual(beforeUnloadGuardEffect(true), { preventDefault: true })
})
