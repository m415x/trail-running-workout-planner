import assert from 'node:assert/strict'
import test from 'node:test'

import {
  authorizeEffectiveCapability,
  type EffectiveAuthorizationInput,
} from '../../lib/authorization/effective-authorization'

const now = '2026-10-07T14:30:00.000Z'

const baseInput = (
  overrides: Partial<EffectiveAuthorizationInput> = {},
): EffectiveAuthorizationInput => ({
  authenticatedUserId: 'user-coach',
  teamId: 'team-a',
  capability: 'planning.manage',
  resource: {
    teamId: 'team-a',
    sportingGroupId: 'group-a',
  },
  at: now,
  memberships: [
    {
      userId: 'user-coach',
      teamId: 'team-a',
      preset: 'coach',
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveUntil: null,
      isActive: true,
    },
  ],
  athleteProfiles: [],
  grants: [],
  ...overrides,
})

test('KAN-658 allows a base preset capability only with one valid TeamMembership', () => {
  assert.equal(authorizeEffectiveCapability(baseInput()).allowed, true)

  assert.equal(
    authorizeEffectiveCapability(baseInput({
      memberships: [],
    })).allowed,
    false,
  )

  assert.equal(
    authorizeEffectiveCapability(baseInput({
      memberships: [
        ...baseInput().memberships,
        {
          userId: 'user-coach',
          teamId: 'team-a',
          preset: 'coach',
          effectiveFrom: '2026-10-02T00:00:00.000Z',
          effectiveUntil: null,
          isActive: true,
        },
      ],
    })).allowed,
    false,
  )
})

test('KAN-658 ignores legacy users.role and denies capability absent from the membership preset', () => {
  assert.equal(
    authorizeEffectiveCapability(baseInput({
      capability: 'team_membership.manage',
      legacyUserRole: 'admin',
    })).allowed,
    false,
  )
})

test('KAN-658 denies inactive, future and expired TeamMemberships', () => {
  for (const membership of [
    {
      userId: 'user-coach',
      teamId: 'team-a',
      preset: 'coach' as const,
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveUntil: null,
      isActive: false,
    },
    {
      userId: 'user-coach',
      teamId: 'team-a',
      preset: 'coach' as const,
      effectiveFrom: '2026-10-08T00:00:00.000Z',
      effectiveUntil: null,
      isActive: true,
    },
    {
      userId: 'user-coach',
      teamId: 'team-a',
      preset: 'coach' as const,
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveUntil: now,
      isActive: true,
    },
  ]) {
    assert.equal(
      authorizeEffectiveCapability(baseInput({
        memberships: [membership],
      })).allowed,
      false,
    )
  }
})

test('KAN-658 denies cross-Team resources before capability or grant evaluation', () => {
  assert.equal(
    authorizeEffectiveCapability(baseInput({
      resource: {
        teamId: 'team-b',
        sportingGroupId: 'group-a',
      },
    })).allowed,
    false,
  )
})

test('KAN-658 applies an active grant only to its beneficiary, Team, capability and scope', () => {
  const grant = {
    id: 'grant-1',
    beneficiaryUserId: 'user-assistant',
    teamId: 'team-a',
    capability: 'training.coordinate' as const,
    scope: 'sporting_group' as const,
    scopeTargetId: 'group-a',
    effectiveFrom: '2026-10-07T13:00:00.000Z',
    effectiveUntil: '2026-10-07T16:00:00.000Z',
    grantedByUserId: 'user-admin',
    reason: 'Temporary session coverage',
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  }

  const assistant = baseInput({
    authenticatedUserId: 'user-assistant',
    capability: 'training.coordinate',
    memberships: [{
      userId: 'user-assistant',
      teamId: 'team-a',
      preset: 'assistant',
      effectiveFrom: '2026-10-01T00:00:00.000Z',
      effectiveUntil: null,
      isActive: true,
    }],
    grants: [grant],
  })

  assert.equal(authorizeEffectiveCapability(assistant).allowed, true)

  assert.equal(
    authorizeEffectiveCapability({
      ...assistant,
      resource: {
        teamId: 'team-a',
        sportingGroupId: 'group-b',
      },
    }).allowed,
    false,
  )

  assert.equal(
    authorizeEffectiveCapability({
      ...assistant,
      authenticatedUserId: 'user-other',
      memberships: [{
        userId: 'user-other',
        teamId: 'team-a',
        preset: 'assistant',
        effectiveFrom: '2026-10-01T00:00:00.000Z',
        effectiveUntil: null,
        isActive: true,
      }],
    }).allowed,
    false,
  )
})

test('KAN-658 denies expired and revoked grants', () => {
  const grant = {
    id: 'grant-1',
    beneficiaryUserId: 'user-assistant',
    teamId: 'team-a',
    capability: 'training.coordinate' as const,
    scope: 'team' as const,
    scopeTargetId: null,
    effectiveFrom: '2026-10-07T13:00:00.000Z',
    effectiveUntil: '2026-10-07T16:00:00.000Z',
    grantedByUserId: 'user-admin',
    reason: 'Temporary coverage',
    revokedAt: '2026-10-07T14:00:00.000Z',
    revokedByUserId: 'user-admin',
    revocationReason: 'Coverage ended',
  }

  assert.equal(
    authorizeEffectiveCapability(baseInput({
      authenticatedUserId: 'user-assistant',
      capability: 'training.coordinate',
      memberships: [{
        userId: 'user-assistant',
        teamId: 'team-a',
        preset: 'assistant',
        effectiveFrom: '2026-10-01T00:00:00.000Z',
        effectiveUntil: null,
        isActive: true,
      }],
      grants: [grant],
    })).allowed,
    false,
  )
})

test('KAN-658 resolves SELF from the authenticated User and same Team only', () => {
  assert.equal(
    authorizeEffectiveCapability(baseInput({
      capability: 'physiology.read',
      athleteProfiles: [{
        id: 'profile-self',
        userId: 'user-coach',
        teamId: 'team-a',
      }],
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'profile-self',
      },
      requiredScope: 'self',
    })).allowed,
    true,
  )

  assert.equal(
    authorizeEffectiveCapability(baseInput({
      capability: 'physiology.read',
      athleteProfiles: [{
        id: 'profile-other',
        userId: 'user-other',
        teamId: 'team-a',
      }],
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'profile-other',
      },
      requiredScope: 'self',
    })).allowed,
    false,
  )
})

test('KAN-658 keeps ASSIGNED_ATHLETES fail-closed in the effective resolver', () => {
  assert.equal(
    authorizeEffectiveCapability(baseInput({
      requiredScope: 'assigned_athletes',
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'athlete-a',
      },
    })).allowed,
    false,
  )
})
