import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirtyFormBrowserProtection } from '../../lib/forms/dirty-form-browser-protection'

test('browser protection reads dirty state when beforeunload fires', () => {
  let dirty = false
  let listener: ((event: { preventDefault(): void; returnValue: string | boolean }) => void) | null = null

  const protection = createDirtyFormBrowserProtection(
    () => dirty,
    (handler) => {
      listener = handler
      return () => {
        listener = null
      }
    },
  )

  protection.start()
  dirty = true

  let prevented = false
  const event = {
    preventDefault() {
      prevented = true
    },
    returnValue: false as string | boolean,
  }

  assert.ok(listener)
  listener(event)
  assert.equal(prevented, true)
  assert.equal(event.returnValue, true)

  protection.stop()
  assert.equal(listener, null)
})
