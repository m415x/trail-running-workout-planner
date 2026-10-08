import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachNavigationH3Authorizer } from '@/lib/authorization/coach-navigation-h3-authorizer'

test('KAN-694 renewed H3 request denies an expired grant and revoked Team membership', async () => {
  let active = true
  const grant = {
    id: 'grant-1',
    beneficiaryUserId: 'user-1',
    teamId: 'team-a',
    capability: 'training.coordinate' as const,
    scope: 'team' as const,
    scopeTargetId: null,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: '2026-10-08T21:00:00.000Z',
    grantedByUserId: 'admin',
    reason: 'Acceptance',
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  }
  const load = createCoachNavigationH3Authorizer({
    loadMemberships: async () => [{ userId: 'user-1', teamId: 'team-a', preset: 'athlete' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: active }],
    loadAthleteProfiles: async () => [],
    loadGrants: async () => [grant],
  })
  const user = { status: 'authenticated' as const, userId: 'user-1' }
  const before = await load(user, 'team-a')
  assert.deepEqual(before({ teamId: 'team-a', capability: 'training.coordinate', resource: { teamId: 'team-a' }, at: '2026-10-08T20:59:59.000Z' }), { allowed: true })
  const after = await load(user, 'team-a')
  assert.deepEqual(after({ teamId: 'team-a', capability: 'training.coordinate', resource: { teamId: 'team-a' }, at: '2026-10-08T21:00:00.000Z' }), { allowed: false })
  active = false
  const revoked = await load(user, 'team-a')
  assert.deepEqual(revoked({ teamId: 'team-a', capability: 'athlete.admin.manage', resource: { teamId: 'team-a' }, at: '2026-10-08T21:00:01.000Z' }), { allowed: false })
  assert.deepEqual(revoked({ teamId: 'team-a', capability: 'training.coordinate', resource: { teamId: 'team-b' }, at: '2026-10-08T21:00:01.000Z' }), { allowed: false })
})
