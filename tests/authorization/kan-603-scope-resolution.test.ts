import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EXECUTABLE_AUTHORIZATION_SCOPES,
  RESERVED_AUTHORIZATION_SCOPES,
  resolveSelfAthleteProfile,
  scopeCoversResource,
} from '../../lib/authorization/scope-resolution'

test('KAN-655 exposes only SELF, SPORTING_GROUP and TEAM as executable scopes', () => {
  assert.deepEqual(
    [...EXECUTABLE_AUTHORIZATION_SCOPES].sort(),
    ['self', 'sporting_group', 'team'],
  )
  assert.deepEqual(RESERVED_AUTHORIZATION_SCOPES, ['assigned_athletes'])
})

test('KAN-655 resolves SELF only from a linked AthleteProfile in the same team', () => {
  const profiles = [
    { id: 'athlete-a', userId: 'user-1', teamId: 'team-a' },
    { id: 'athlete-b', userId: 'user-1', teamId: 'team-b' },
    { id: 'athlete-unlinked', userId: null, teamId: 'team-a' },
  ]

  assert.equal(
    resolveSelfAthleteProfile(profiles, {
      userId: 'user-1',
      teamId: 'team-a',
    }),
    'athlete-a',
  )
  assert.equal(
    resolveSelfAthleteProfile(profiles, {
      userId: 'user-2',
      teamId: 'team-a',
    }),
    null,
  )
  assert.equal(
    resolveSelfAthleteProfile(profiles, {
      userId: 'user-1',
      teamId: 'team-c',
    }),
    null,
  )
})

test('KAN-655 fails SELF closed when profile linkage is ambiguous', () => {
  const profiles = [
    { id: 'athlete-a1', userId: 'user-1', teamId: 'team-a' },
    { id: 'athlete-a2', userId: 'user-1', teamId: 'team-a' },
  ]

  assert.throws(
    () => resolveSelfAthleteProfile(profiles, {
      userId: 'user-1',
      teamId: 'team-a',
    }),
    /Conflicting AthleteProfile records/,
  )
})

test('KAN-655 SELF covers only the actor sporting subject in the same team', () => {
  assert.equal(
    scopeCoversResource({
      scope: 'self',
      actorTeamId: 'team-a',
      selfAthleteProfileId: 'athlete-a',
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'athlete-a',
      },
    }),
    true,
  )
  assert.equal(
    scopeCoversResource({
      scope: 'self',
      actorTeamId: 'team-a',
      selfAthleteProfileId: 'athlete-a',
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'athlete-b',
      },
    }),
    false,
  )
  assert.equal(
    scopeCoversResource({
      scope: 'self',
      actorTeamId: 'team-a',
      selfAthleteProfileId: null,
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'athlete-a',
      },
    }),
    false,
  )
})

test('KAN-655 SPORTING_GROUP covers only its explicit group inside the same team', () => {
  assert.equal(
    scopeCoversResource({
      scope: 'sporting_group',
      actorTeamId: 'team-a',
      scopeTargetId: 'group-a',
      resource: {
        teamId: 'team-a',
        sportingGroupId: 'group-a',
      },
    }),
    true,
  )
  assert.equal(
    scopeCoversResource({
      scope: 'sporting_group',
      actorTeamId: 'team-a',
      scopeTargetId: 'group-a',
      resource: {
        teamId: 'team-a',
        sportingGroupId: 'group-b',
      },
    }),
    false,
  )
})

test('KAN-655 TEAM covers resources only inside the actor team', () => {
  assert.equal(
    scopeCoversResource({
      scope: 'team',
      actorTeamId: 'team-a',
      resource: { teamId: 'team-a' },
    }),
    true,
  )
  assert.equal(
    scopeCoversResource({
      scope: 'team',
      actorTeamId: 'team-a',
      resource: { teamId: 'team-b' },
    }),
    false,
  )
})

test('KAN-655 denies every scope before evaluating a cross-team resource', () => {
  for (const scope of ['self', 'sporting_group', 'team'] as const) {
    assert.equal(
      scopeCoversResource({
        scope,
        actorTeamId: 'team-a',
        selfAthleteProfileId: 'athlete-a',
        scopeTargetId: 'group-a',
        resource: {
          teamId: 'team-b',
          athleteProfileId: 'athlete-a',
          sportingGroupId: 'group-a',
        },
      }),
      false,
    )
  }
})

test('KAN-655 keeps ASSIGNED_ATHLETES reserved and always fail-closed', () => {
  assert.equal(
    scopeCoversResource({
      scope: 'assigned_athletes',
      actorTeamId: 'team-a',
      scopeTargetId: 'athlete-a',
      resource: {
        teamId: 'team-a',
        athleteProfileId: 'athlete-a',
      },
    }),
    false,
  )
})
