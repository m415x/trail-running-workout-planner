import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationH3Authorizer } from '@/lib/authorization/coach-navigation-h3-authorizer'

test('KAN-691 reads H3 evidence once per projection and evaluates each capability with the canonical H3 resolver', async () => {
  const reads = { memberships: 0, profiles: 0, grants: 0 }
  const authorize = createCoachNavigationH3Authorizer({
    loadMemberships: async () => {
      reads.memberships++
      return [{ userId: 'u1', teamId: 'team-a', preset: 'coach' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true }]
    },
    loadAthleteProfiles: async () => { reads.profiles++; return [] },
    loadGrants: async () => { reads.grants++; return [] },
  })
  const access = { status: 'authenticated' as const, userId: 'u1' }
  const evaluate = await authorize(access, 'team-a')
  const at = '2026-10-08T15:00:00.000Z'
  assert.deepEqual(evaluate({ teamId: 'team-a', capability: 'planning.manage', resource: { teamId: 'team-a' }, at }), { allowed: true })
  assert.deepEqual(evaluate({ teamId: 'team-a', capability: 'economic_policy.manage', resource: { teamId: 'team-a' }, at }), { allowed: true })
  assert.deepEqual(evaluate({ teamId: 'team-a', capability: 'athlete.admin.manage', resource: { teamId: 'team-a' }, at }), { allowed: true })
  assert.deepEqual(evaluate({ teamId: 'team-a', capability: 'sporting_group.admin.manage', resource: { teamId: 'team-a' }, at }), { allowed: true })
  assert.deepEqual(reads, { memberships: 1, profiles: 1, grants: 1 })
})

test('KAN-691 H3 batch authority cannot be derived for a forbidden actor', async () => {
  let called = false
  const authorize = createCoachNavigationH3Authorizer({
    loadMemberships: async () => { called = true; return [] },
    loadAthleteProfiles: async () => { called = true; return [] },
    loadGrants: async () => { called = true; return [] },
  })
  const evaluate = await authorize({ status: 'forbidden', reason: 'anonymous' }, 'team-a')
  assert.deepEqual(evaluate({ teamId: 'team-a', capability: 'planning.manage', resource: { teamId: 'team-a' }, at: '2026-10-08T15:00:00.000Z' }), { allowed: false })
  assert.equal(called, false)
})
