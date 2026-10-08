import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationResumeRefresh } from '@/lib/authorization/coach-navigation-resume-refresh'

test('KAN-694 refreshes the server projection on tab resume only when it becomes visible', () => {
  let refreshes = 0
  const controller = createCoachNavigationResumeRefresh(() => { refreshes++ })
  controller.onVisibilityChange(false)
  controller.onVisibilityChange(true)
  assert.equal(refreshes, 1)
})

test('KAN-694 refreshes after focus returns without duplicating a visibility refresh', () => {
  let refreshes = 0
  const controller = createCoachNavigationResumeRefresh(() => { refreshes++ })
  controller.onVisibilityChange(true)
  controller.onFocus()
  assert.equal(refreshes, 1)
})

test('KAN-694 allows an independent refresh on a later focus event', () => {
  let refreshes = 0
  const controller = createCoachNavigationResumeRefresh(() => { refreshes++ })
  controller.onFocus()
  controller.onFocus()
  assert.equal(refreshes, 2)
})
