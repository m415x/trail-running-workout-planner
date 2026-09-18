import assert from 'node:assert/strict'
import test from 'node:test'
import { createDashboardDirtyFormGuard } from '../../lib/forms/dashboard-dirty-form-guard'
import { applyBeforeUnloadProtection } from '../../lib/forms/dirty-form-before-unload'

test('registered dirty athlete form protects browser unload', () => {
  const guard = createDashboardDirtyFormGuard()
  let prevented = false
  const event = {
    preventDefault() {
      prevented = true
    },
    returnValue: false as string | boolean,
  }

  guard.register({ name: 'Ana' })
  guard.update({ name: 'Anita' })
  applyBeforeUnloadProtection(guard.isDirty(), event)

  assert.equal(prevented, true)
  assert.equal(event.returnValue, 'Unsaved changes')
})
