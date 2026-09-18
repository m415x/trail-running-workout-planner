import assert from 'node:assert/strict'
import test from 'node:test'
import {
  dirtyFormFingerprint,
  guardedNavigationDecision,
  isDirtyFormState,
  shouldProtectBeforeUnload,
} from '../../lib/forms/dirty-form'

test('dirty state compares normalized values rather than object key order', () => {
  const baseline = { name: 'Ana', active: true, nested: { level: 2, note: null } }
  const reordered = { nested: { note: null, level: 2 }, active: true, name: 'Ana' }

  assert.equal(dirtyFormFingerprint(baseline), dirtyFormFingerprint(reordered))
  assert.equal(isDirtyFormState(baseline, reordered), false)
})

test('meaningful changes become dirty and restoring the baseline becomes clean', () => {
  const baseline = { name: 'Ana', groups: ['trail', 'advanced'] }

  assert.equal(isDirtyFormState(baseline, { ...baseline, name: 'Ana María' }), true)
  assert.equal(isDirtyFormState(baseline, { ...baseline, name: 'Ana' }), false)
  assert.equal(isDirtyFormState(baseline, { ...baseline, groups: ['advanced', 'trail'] }), true)
})

test('navigation and unload policy only protect meaningful dirty state', () => {
  assert.equal(guardedNavigationDecision(false), 'proceed')
  assert.equal(guardedNavigationDecision(true), 'confirm')
  assert.equal(shouldProtectBeforeUnload(false), false)
  assert.equal(shouldProtectBeforeUnload(true), true)
})
