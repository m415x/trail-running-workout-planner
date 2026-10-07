import assert from 'node:assert/strict'
import test from 'node:test'

import {
  authorizeAuthenticatedCapability,
  type AuthenticatedAuthorizationInput,
} from '../../lib/authorization/authenticated-authorization'

const input = (
  overrides: Partial<AuthenticatedAuthorizationInput> = {},
): AuthenticatedAuthorizationInput => ({
  teamId: 'team-a',
  capability: 'training.coordinate',
  resource: {
    teamId: 'team-a',
    sportingGroupId: 'group-a',
  },
  at: '2026-10-07T14:30:00.000Z',
  memberships: [{
    userId: 'user-assistant',
    teamId: 'team-a',
    preset: 'assistant',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
    effectiveUntil: null,
    isActive: true,
  }],
  athleteProfiles: [],
  grants: [{
    id: 'grant-1',
    beneficiaryUserId: 'user-assistant',
    teamId: 'team-a',
    capability: 'training.coordinate',
    scope: 'sporting_group',
    scopeTargetId: 'group-a',
    effectiveFrom: '2026-10-07T13:00:00.000Z',
    effectiveUntil: '2026-10-07T16:00:00.000Z',
    grantedByUserId: 'user-admin',
    reason: 'Temporary coverage',
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
  }],
  ...overrides,
})

test('KAN-658 derives the effective actor only from authenticated H2 access', () => {
  assert.equal(
    authorizeAuthenticatedCapability(
      {
        status: 'authenticated',
        userId: 'user-assistant',
      },
      input(),
    ).allowed,
    true,
  )

  assert.equal(
    authorizeAuthenticatedCapability(
      {
        status: 'authenticated',
        userId: 'user-other',
      },
      input(),
    ).allowed,
    false,
  )
})

test('KAN-658 denies every forbidden H2 access state before H3 evaluation', () => {
  for (const reason of ['anonymous', 'unlinked', 'invalid'] as const) {
    assert.equal(
      authorizeAuthenticatedCapability(
        {
          status: 'forbidden',
          reason,
        },
        input(),
      ).allowed,
      false,
    )
  }
})

test('KAN-658 authenticated boundary input has no client-selectable actor field', () => {
  const boundaryInput = input()

  assert.equal('authenticatedUserId' in boundaryInput, false)
  assert.equal('actorUserId' in boundaryInput, false)
  assert.equal('userId' in boundaryInput, false)
})
