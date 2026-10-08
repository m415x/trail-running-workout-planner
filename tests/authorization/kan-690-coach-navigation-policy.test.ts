import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COACH_NAVIGATION_POLICY,
  visibleCoachNavigationDestinations,
} from '@/lib/authorization/coach-navigation-policy'

test('KAN-690 Coach navigation visibility policy is exhaustive and only uses H3 capability keys', () => {
  assert.deepEqual(COACH_NAVIGATION_POLICY, [
    { href: '/dashboard', visibility: { kind: 'alwaysAuthenticated' } },
    { href: '/dashboard/athletes', visibility: { kind: 'capability', key: 'athlete.admin.manage' } },
    { href: '/dashboard/groups', visibility: { kind: 'capability', key: 'sporting_group.admin.manage' } },
    { href: '/dashboard/cohorts', visibility: { kind: 'capability', key: 'planning.manage' } },
    { href: '/dashboard/planning', visibility: { kind: 'capability', key: 'planning.manage' } },
    { href: '/dashboard/membership', visibility: { kind: 'capability', key: 'economic_policy.manage' } },
    { href: '/dashboard/competitions', visibility: { kind: 'hidden' } },
    { href: '/dashboard/sessions', visibility: { kind: 'capability', key: 'planning.manage' } },
    { href: '/dashboard/templates', visibility: { kind: 'hidden' } },
  ])
})

test('KAN-690 default deny: authenticated basic navigation stays, unresolved authority hides privileges', () => {
  assert.deepEqual(visibleCoachNavigationDestinations(COACH_NAVIGATION_POLICY, new Set()), ['/dashboard'])
  assert.deepEqual(
    visibleCoachNavigationDestinations(COACH_NAVIGATION_POLICY, new Set(['planning.manage'])),
    ['/dashboard', '/dashboard/cohorts', '/dashboard/planning', '/dashboard/sessions'],
  )
  assert.deepEqual(
    visibleCoachNavigationDestinations(COACH_NAVIGATION_POLICY, new Set(['economic_policy.manage'])),
    ['/dashboard', '/dashboard/membership'],
  )
})
