import assert from 'node:assert/strict'
import test from 'node:test'

import { createH5aSelfContextBoundary } from '@/lib/authorization/h5a-self-context'

const presets = ['athlete', 'assistant', 'coach', 'admin'] as const
const now = '2026-10-09T12:00:00.000Z'

function fixture(options: {
  preset?: typeof presets[number]
  profiles?: Array<{ id: string; userId: string | null; teamId: string }>
  team?: { status: 'resolved'; teamId: string } | { status: 'denied' }
  memberships?: Array<{
    userId: string; teamId: string; preset: typeof presets[number];
    effectiveFrom: string; effectiveUntil: string | null; isActive: boolean
  }>
} = {}) {
  const calls: string[] = []
  const memberships = options.memberships ?? [{
    userId: 'user-a', teamId: 'team-a', preset: options.preset ?? 'athlete',
    effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true,
  }]
  const profiles = options.profiles ?? [{ id: 'athlete-a', userId: 'user-a', teamId: 'team-a' }]
  return {
    calls,
    boundary: createH5aSelfContextBoundary({
      resolveActiveTeam: async (userId: string) => {
        calls.push('team:' + userId)
        return options.team ?? { status: 'resolved' as const, teamId: 'team-a' }
      },
      loadMemberships: async (userId: string, teamId: string) => {
        calls.push('membership:' + userId + ':' + teamId)
        return memberships
      },
      loadAthleteProfiles: async (userId: string, teamId: string) => {
        calls.push('profile:' + userId + ':' + teamId)
        return profiles
      },
    }),
  }
}

test('KAN-697 authenticated EPT User resolves exactly one SELF AthleteProfile in active Team for every preset', async () => {
  for (const preset of presets) {
    const { boundary, calls } = fixture({ preset })
    const result = await boundary.resolve({ status: 'authenticated', userId: 'user-a' }, { at: now })
    assert.deepEqual(result, { status: 'resolved', userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a' })
    assert.ok(calls.includes('team:user-a'))
    assert.ok(calls.includes('profile:user-a:team-a'))
  }
})

test('KAN-697 H2 denial short-circuits before Team/profile reads', async () => {
  const { boundary, calls } = fixture()
  const result = await boundary.resolve({ status: 'forbidden', reason: 'anonymous' }, { at: now })
  assert.deepEqual(result, { status: 'denied' })
  assert.deepEqual(calls, [])
})

test('KAN-697 unresolved Team or absent/cross-Team/ambiguous profile denies', async () => {
  const scenarios = [
    fixture({ team: { status: 'denied' } }),
    fixture({ profiles: [] }),
    fixture({ profiles: [{ id: 'other', userId: 'user-a', teamId: 'team-b' }] }),
    fixture({ profiles: [{ id: 'athlete-a', userId: 'user-a', teamId: 'team-a' }, { id: 'athlete-b', userId: 'user-a', teamId: 'team-a' }] }),
  ]
  for (const { boundary } of scenarios) {
    assert.deepEqual(await boundary.resolve({ status: 'authenticated', userId: 'user-a' }, { at: now }), { status: 'denied' })
  }
})

test('KAN-697 missing, expired and ambiguous memberships deny without fallback to preset or users.role', async () => {
  const membership = {
    userId: 'user-a', teamId: 'team-a', preset: 'coach' as const,
    effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true,
  }
  for (const memberships of [[], [{ ...membership, isActive: false }], [{ ...membership, effectiveUntil: '2026-09-01T00:00:00.000Z' }], [membership, membership]]) {
    const { boundary } = fixture({ memberships })
    assert.deepEqual(await boundary.resolve({ status: 'authenticated', userId: 'user-a' }, { at: now }), { status: 'denied' })
  }
})
