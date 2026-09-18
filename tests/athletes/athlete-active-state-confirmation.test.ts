import assert from 'node:assert/strict'
import test from 'node:test'

import {
  requiresAthleteActiveStateConfirmation,
  targetAthleteActiveState,
} from '../../features/athletes/lib/athlete-active-state-confirmation'

test('deactivating an active athlete requires confirmation', () => {
  assert.equal(targetAthleteActiveState(true), false)
  assert.equal(requiresAthleteActiveStateConfirmation(true), true)
})

test('activating an inactive athlete does not require confirmation', () => {
  assert.equal(targetAthleteActiveState(false), true)
  assert.equal(requiresAthleteActiveStateConfirmation(false), false)
})
