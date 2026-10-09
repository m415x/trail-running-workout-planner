import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationRevalidationPolicy } from '@/lib/authorization/coach-navigation-revalidation'

test('KAN-694 requires fresh navigation after Team, session and authority changes', () => {
  const policy = createCoachNavigationRevalidationPolicy()
  assert.equal(policy.shouldRefresh('active-team-changed'), true)
  assert.equal(policy.shouldRefresh('session-changed'), true)
  assert.equal(policy.shouldRefresh('membership-changed'), true)
  assert.equal(policy.shouldRefresh('grant-changed'), true)
  assert.equal(policy.shouldRefresh('grant-expired'), true)
})

test('KAN-694 does not treat arbitrary rendering or route changes as authority updates', () => {
  const policy = createCoachNavigationRevalidationPolicy()
  assert.equal(policy.shouldRefresh('render'), false)
  assert.equal(policy.shouldRefresh('route-changed'), false)
})
