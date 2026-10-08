import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationServerProjection } from '@/lib/authorization/coach-navigation-server-projection'

test('KAN-692 composes authenticated H2 actor with active Team and batched H3 evidence on server', async () => {
  const reads = { memberships: 0, profiles: 0, grants: 0 }
  const project = createCoachNavigationServerProjection({
    resolveActiveTeam: async (userId) => {
      assert.equal(userId, 'actor')
      return { status: 'resolved', teamId: 'team-a', source: 'single_membership' }
    },
    evidence: {
      loadMemberships: async () => {
        reads.memberships++
        return [{ userId: 'actor', teamId: 'team-a', preset: 'coach', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true }]
      },
      loadAthleteProfiles: async () => { reads.profiles++; return [] },
      loadGrants: async () => { reads.grants++; return [] },
    },
  })

  assert.deepEqual(await project({ status: 'authenticated', userId: 'actor' }), [
    '/dashboard',
    '/dashboard/athletes',
    '/dashboard/groups',
    '/dashboard/cohorts',
    '/dashboard/planning',
    '/dashboard/membership',
    '/dashboard/sessions',
  ])
  assert.deepEqual(reads, { memberships: 1, profiles: 1, grants: 1 })
})

test('KAN-692 keeps privileged links absent when active Team cannot be resolved', async () => {
  const project = createCoachNavigationServerProjection({
    resolveActiveTeam: async () => ({ status: 'selection_required' }),
    evidence: {
      loadMemberships: async () => { throw new Error('must not load') },
      loadAthleteProfiles: async () => { throw new Error('must not load') },
      loadGrants: async () => { throw new Error('must not load') },
    },
  })
  assert.deepEqual(await project({ status: 'authenticated', userId: 'actor' }), ['/dashboard'])
})
