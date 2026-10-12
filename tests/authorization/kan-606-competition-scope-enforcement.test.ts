import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeEffectiveCapability } from '../../lib/authorization/effective-authorization'

const at = '2026-10-11T12:00:00.000Z'
const base = {
  authenticatedUserId: 'coach-1',
  teamId: 'team-a',
  capability: 'competition.manage' as const,
  resource: { teamId: 'team-a', athleteProfileId: 'athlete-1' },
  at,
  memberships: [{ userId: 'coach-1', teamId: 'team-a', preset: 'coach' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true }],
  athleteProfiles: [{ id: 'athlete-1', userId: 'coach-1', teamId: 'team-a' }],
  grants: [],
}

test('KAN-606 H4C grants only TEAM scope and denies other requested scopes', () => {
  assert.equal(authorizeEffectiveCapability({ ...base, requiredScope: 'team' }).allowed, true)
  assert.equal(authorizeEffectiveCapability({ ...base, requiredScope: 'self' }).allowed, false)
  assert.equal(authorizeEffectiveCapability({ ...base, requiredScope: 'sporting_group' }).allowed, false)
  assert.equal(authorizeEffectiveCapability({ ...base, requiredScope: 'assigned_athletes' }).allowed, false)
  assert.equal(authorizeEffectiveCapability({ ...base, resource: { teamId: 'team-b' }, requiredScope: 'team' }).allowed, false)
})
