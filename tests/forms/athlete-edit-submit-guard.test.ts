import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldMarkAthleteEditSaved } from '../../features/athletes/lib/athlete-edit-submit-guard'

test('successful athlete edit completion establishes a safe baseline', () => {
  assert.equal(
    shouldMarkAthleteEditSaved({ pending: false, error: undefined, wasPending: true }),
    true,
  )
})

test('failed athlete edit completion preserves dirty state', () => {
  assert.equal(
    shouldMarkAthleteEditSaved({ pending: false, error: 'Duplicate email', wasPending: true }),
    false,
  )
})

test('initial and in-flight renders do not reset the baseline', () => {
  assert.equal(
    shouldMarkAthleteEditSaved({ pending: false, error: undefined, wasPending: false }),
    false,
  )
  assert.equal(
    shouldMarkAthleteEditSaved({ pending: true, error: undefined, wasPending: true }),
    false,
  )
})
