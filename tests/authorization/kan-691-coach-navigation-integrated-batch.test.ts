import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationProjection } from '@/lib/authorization/coach-navigation-projection'
import { createCoachNavigationH3Authorizer } from '@/lib/authorization/coach-navigation-h3-authorizer'

test('KAN-691 end-to-end projection shares H3 evidence across all Coach destination capabilities', async () => {
  const reads = { memberships: 0, profiles: 0, grants: 0 }
  const loadAuthorizer = createCoachNavigationH3Authorizer({
    async loadMemberships() {
      reads.memberships++
      return [{ userId: 'actor', teamId: 'team-a', preset: 'coach' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true }]
    },
    async loadAthleteProfiles() { reads.profiles++; return [] },
    async loadGrants() { reads.grants++; return [] },
  })
  const project = createCoachNavigationProjection({
    resolveActiveTeam: async () => ({ status: 'resolved' as const, teamId: 'team-a', source: 'single_membership' as const }),
    loadAuthorizer,
  })
  const visible = await project({ status: 'authenticated', userId: 'actor' })
  assert.deepEqual(visible, ['/dashboard', '/dashboard/athletes', '/dashboard/groups', '/dashboard/cohorts', '/dashboard/planning', '/dashboard/membership', '/dashboard/sessions'])
  assert.deepEqual(reads, { memberships: 1, profiles: 1, grants: 1 })
})
