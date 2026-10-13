import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectAcceptanceAthleteBIdentity } from '@/lib/acceptance/athlete-b-identity-preflight'

const expected = {
  userId: 'accept_athlete_b',
  provider: 'supabase' as const,
  subject: 'synthetic-supabase-subject-b',
  teamId: 'team_1',
  preset: 'athlete' as const,
  profileId: 'accept_profile_athlete_b',
  groupId: null,
}

const empty = {
  usersById: [],
  linksBySubject: [],
  linksByUserId: [],
  membershipsByUserId: [],
  profilesByUserId: [],
}

test('KAN-780 preflight classifies completely absent identity with verified subject', () => {
  assert.equal(inspectAcceptanceAthleteBIdentity({ expected, ...empty }).status, 'absent')
})

test('KAN-780 preflight refuses missing or unverified external subject', () => {
  assert.equal(inspectAcceptanceAthleteBIdentity({
    expected: { ...expected, subject: '' }, ...empty,
  }).status, 'incompatible')
})

test('KAN-780 preflight rejects provider-subject collision with another EPT user', () => {
  assert.equal(inspectAcceptanceAthleteBIdentity({
    expected, ...empty,
    linksBySubject: [{ userId: 'accept_h4b_athlete', provider: 'supabase', subject: expected.subject }],
  }).status, 'incompatible')
})

test('KAN-780 preflight treats partial provisioning as incompatible, never absent', () => {
  assert.equal(inspectAcceptanceAthleteBIdentity({
    expected, ...empty, usersById: [{ id: expected.userId }],
  }).status, 'incompatible')
})

test('KAN-780 preflight denies additional memberships, links or profiles for B', () => {
  const complete = {
    expected,
    usersById: [{ id: expected.userId }],
    linksBySubject: [{ userId: expected.userId, provider: 'supabase', subject: expected.subject }],
    linksByUserId: [{ userId: expected.userId, provider: 'supabase', subject: expected.subject }],
    membershipsByUserId: [{ userId: expected.userId, teamId: 'team_1', preset: 'athlete', isActive: true }],
    profilesByUserId: [{ id: expected.profileId, userId: expected.userId, teamId: 'team_1', groupId: null }],
  }
  assert.equal(inspectAcceptanceAthleteBIdentity(complete).status, 'complete')
  assert.equal(inspectAcceptanceAthleteBIdentity({
    ...complete,
    membershipsByUserId: [...complete.membershipsByUserId, { userId: expected.userId, teamId: 'team_2', preset: 'coach', isActive: true }],
  }).status, 'incompatible')
  assert.equal(inspectAcceptanceAthleteBIdentity({
    ...complete,
    linksByUserId: [...complete.linksByUserId, { userId: expected.userId, provider: 'supabase', subject: 'other' }],
  }).status, 'incompatible')
  assert.equal(inspectAcceptanceAthleteBIdentity({
    ...complete,
    profilesByUserId: [...complete.profilesByUserId, { id: 'other', userId: expected.userId, teamId: 'team_2', groupId: null }],
  }).status, 'incompatible')
})
