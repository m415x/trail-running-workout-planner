import assert from 'node:assert/strict'
import test from 'node:test'

import { createH5bSelfContextBoundary } from '@/lib/authorization/h5b-self-context'

const at = '2026-10-09T12:00:00.000Z'
const access = { status: 'authenticated' as const, userId: 'user-a' }
const memberships = [
  { userId: 'user-a', teamId: 'team-a', preset: 'athlete' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true },
  { userId: 'user-a', teamId: 'team-b', preset: 'coach' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true },
]
const profiles = [
  { id: 'athlete-a', teamId: 'team-a', userId: 'user-a' },
  { id: 'athlete-b', teamId: 'team-b', userId: 'user-a' },
  { id: 'other-athlete', teamId: 'team-a', userId: 'user-other' },
]

test('KAN-713 H5B resolves athlete subject only inside active Team for multi-Team actor', async () => {
  const calls: string[] = []
  const boundary = createH5bSelfContextBoundary({
    resolveActiveTeam: async () => ({ status: 'resolved', teamId: 'team-b' }),
    loadMemberships: async (_userId, teamId) => { calls.push(`membership:${teamId}`); return memberships.filter(m => m.teamId === teamId) },
    loadAthleteProfiles: async (_userId, teamId) => { calls.push(`profile:${teamId}`); return profiles.filter(p => p.teamId === teamId) },
  })
  for (const capability of ['stats.self.read', 'physiology.self.read'] as const) {
    assert.deepEqual(await boundary.resolve(access, { at, capability }), {
      status: 'resolved', userId: 'user-a', teamId: 'team-b', athleteProfileId: 'athlete-b',
    })
  }
  assert.deepEqual(calls, ['membership:team-b','profile:team-b','membership:team-b','profile:team-b'])
})

test('KAN-713 H5B denies another athlete even when Coach preset grants other team-scoped capabilities', async () => {
  const boundary = createH5bSelfContextBoundary({
    resolveActiveTeam: async () => ({ status: 'resolved', teamId: 'team-b' }),
    loadMemberships: async () => memberships.filter(m => m.teamId === 'team-b'),
    loadAthleteProfiles: async () => [profiles[2]!],
  })
  assert.deepEqual(await boundary.resolve(access, { at, capability: 'stats.self.read' }), { status: 'denied' })
})
