import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirtyFormBaseline } from '../../lib/forms/dirty-form-baseline'

test('baseline tracks clean, dirty, and restored form states', () => {
  const baseline = createDirtyFormBaseline({ name: 'Ana', level: 2 })

  assert.equal(baseline.isDirty({ name: 'Ana', level: 2 }), false)
  assert.equal(baseline.isDirty({ name: 'Ana María', level: 2 }), true)
  assert.equal(baseline.isDirty({ name: 'Ana', level: 2 }), false)
})

test('successful save can establish the saved state as the new clean baseline', () => {
  const baseline = createDirtyFormBaseline({ name: 'Ana' })
  const saved = { name: 'Ana María' }

  assert.equal(baseline.isDirty(saved), true)

  baseline.reset(saved)

  assert.equal(baseline.isDirty(saved), false)
  assert.equal(baseline.isDirty({ name: 'Ana' }), true)
})

test('failed save preserves the previous baseline because reset is not called', () => {
  const baseline = createDirtyFormBaseline({ name: 'Ana' })
  const attempted = { name: 'Ana María' }

  assert.equal(baseline.isDirty(attempted), true)
  assert.equal(baseline.isDirty(attempted), true)
})
