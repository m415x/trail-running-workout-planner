import assert from 'node:assert/strict'
import test from 'node:test'
import { createDirtyFormBrowserProtection } from '../../lib/forms/dirty-form-browser-protection'

test('browser protection reads dirty state when beforeunload fires', () => {
  let dirty = false
  const listeners = new Set<
    (event: { preventDefault(): void; returnValue: string | boolean }) => void
  >()

  const protection = createDirtyFormBrowserProtection(
    () => dirty,
    (handler) => {
      listeners.add(handler)
      return () => {
        listeners.delete(handler)
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

  assert.equal(listeners.size, 1)
  for (const listener of listeners) listener(event)
  assert.equal(prevented, true)
  assert.equal(event.returnValue, 'Unsaved changes')

  protection.stop()
  assert.equal(listeners.size, 0)
})
