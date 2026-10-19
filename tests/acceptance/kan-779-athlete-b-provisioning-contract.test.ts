import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyAcceptanceAthleteBProvisioning } from '@/lib/acceptance/athlete-b-provisioning-contract'

const expected = {
  userId: 'accept_athlete_b',
  provider: 'supabase' as const,
  subject: 'synthetic-subject-b',
  teamId: 'team_1',
  preset: 'athlete' as const,
  profileId: 'accept_profile_athlete_b',
  groupId: null,
}

test('KAN-779 classifies absent, complete and incompatible without inferring by email', () => {
  assert.equal(classifyAcceptanceAthleteBProvisioning({ expected, user: null, link: null, membership: null, profile: null }), 'absent')
  assert.equal(classifyAcceptanceAthleteBProvisioning({
    expected,
    user: { id: expected.userId },
    link: { userId: expected.userId, provider: 'supabase', subject: expected.subject },
    membership: { userId: expected.userId, teamId: 'team_1', preset: 'athlete', isActive: true },
    profile: { id: expected.profileId, userId: expected.userId, teamId: 'team_1', groupId: null },
  }), 'complete')
  assert.equal(classifyAcceptanceAthleteBProvisioning({ expected, user: { id: expected.userId }, link: null, membership: null, profile: null }), 'incompatible')
})

test('KAN-779 rejects subject collisions, wrong Team and assigned group fail-closed', () => {
  const base = {
    expected,
    user: { id: expected.userId },
    link: { userId: expected.userId, provider: 'supabase', subject: expected.subject },
    membership: { userId: expected.userId, teamId: 'team_1', preset: 'athlete', isActive: true },
    profile: { id: expected.profileId, userId: expected.userId, teamId: 'team_1', groupId: null },
  }
  assert.equal(classifyAcceptanceAthleteBProvisioning({ ...base, link: { ...base.link, subject: 'other-subject' } }), 'incompatible')
  assert.equal(classifyAcceptanceAthleteBProvisioning({ ...base, membership: { ...base.membership, teamId: 'team_2' } }), 'incompatible')
  assert.equal(classifyAcceptanceAthleteBProvisioning({ ...base, profile: { ...base.profile, groupId: 'group-from-seed' } }), 'incompatible')
})
