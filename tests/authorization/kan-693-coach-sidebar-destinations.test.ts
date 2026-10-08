import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCoachSidebarDestinations } from '@/components/dashboard/coach-sidebar-destinations'

test('KAN-693 Coach sidebar intersects server allowlist with frozen route catalog', () => {
  assert.deepEqual(
    selectCoachSidebarDestinations([
      '/dashboard',
      '/dashboard/athletes',
      '/dashboard/sessions',
      '/dashboard/competitions',
      '/dashboard/templates',
      '/dashboard/unknown',
    ]),
    ['/dashboard', '/dashboard/athletes', '/dashboard/sessions'],
  )
})

test('KAN-693 deny by default and preserve canonical order independent of allowlist order', () => {
  assert.deepEqual(selectCoachSidebarDestinations([]), [])
  assert.deepEqual(
    selectCoachSidebarDestinations(['/dashboard/sessions', '/dashboard', '/dashboard/sessions']),
    ['/dashboard', '/dashboard/sessions'],
  )
})
