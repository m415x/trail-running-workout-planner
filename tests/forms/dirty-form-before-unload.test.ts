import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyBeforeUnloadProtection,
  type BeforeUnloadEventLike,
} from '../../lib/forms/dirty-form-before-unload'

test('clean state leaves beforeunload untouched', () => {
  let prevented = false
  const event: BeforeUnloadEventLike = {
    preventDefault() {
      prevented = true
    },
    returnValue: '',
  }

  applyBeforeUnloadProtection(false, event)

  assert.equal(prevented, false)
  assert.equal(event.returnValue, '')
})

test('dirty state prevents unload and requests the browser-owned prompt', () => {
  let prevented = false
  const event: BeforeUnloadEventLike = {
    preventDefault() {
      prevented = true
    },
    returnValue: '',
  }

  applyBeforeUnloadProtection(true, event)

  assert.equal(prevented, true)
  assert.equal(event.returnValue, true)
})
