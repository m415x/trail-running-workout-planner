import assert from 'node:assert/strict'
import test from 'node:test'

import { createH5bSelfContextBoundary } from '@/lib/authorization/h5b-self-context'

const at = '2026-10-09T12:00:00.000Z'
const access = { status: 'authenticated' as const, userId: 'user_a' }
const memberships = [{ userId: 'user_a', teamId: 'team_a', preset: 'athlete' as const, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null, isActive: true }]
const profiles = [{ id: 'athlete_a', userId: 'user_a', teamId: 'team_a' }]

function boundary(options: {
  activeTeam?: { status: string; teamId?: string }
  members?: typeof memberships
  athletes?: typeof profiles
} = {}) {
  return createH5bSelfContextBoundary({
    resolveActiveTeam: async () => options.activeTeam ?? { status: 'resolved', teamId: 'team_a' },
    loadMemberships: async () => options.members ?? memberships,
    loadAthleteProfiles: async () => options.athletes ?? profiles,
  })
}

test('KAN-706 resolves only the authenticated SELF sporting subject for each H5B read capability', async () => {
  for (const capability of ['stats.self.read', 'physiology.self.read'] as const) {
    assert.deepEqual(await boundary().resolve(access, { at, capability }), {
      status: 'resolved', userId: 'user_a', teamId: 'team_a', athleteProfileId: 'athlete_a',
    })
  }
})

test('KAN-706 denies invalid H2 identity, revoked membership, absent or ambiguous SELF profile', async () => {
  assert.deepEqual(await boundary().resolve({ status: 'forbidden', reason: 'anonymous' }, { at, capability: 'stats.self.read' }), { status: 'denied' })
  assert.deepEqual(await boundary({ members: [{ ...memberships[0]!, isActive: false }] }).resolve(access, { at, capability: 'stats.self.read' }), { status: 'denied' })
  assert.deepEqual(await boundary({ athletes: [] }).resolve(access, { at, capability: 'stats.self.read' }), { status: 'denied' })
  assert.deepEqual(await boundary({ athletes: [profiles[0]!, { ...profiles[0]!, id: 'athlete_2' }] }).resolve(access, { at, capability: 'stats.self.read' }), { status: 'denied' })
  assert.deepEqual(await boundary({ activeTeam: { status: 'denied' } }).resolve(access, { at, capability: 'physiology.self.read' }), { status: 'denied' })
})

test('KAN-706 Coach with own sporting profile may read SELF, never another athlete', async () => {
  const coach = boundary({ members: [{ ...memberships[0]!, preset: 'coach' }] })
  assert.deepEqual(await coach.resolve(access, { at, capability: 'physiology.self.read' }), {
    status: 'resolved', userId: 'user_a', teamId: 'team_a', athleteProfileId: 'athlete_a',
  })
  assert.deepEqual(await boundary({ athletes: [{ id: 'athlete_b', userId: 'user_b', teamId: 'team_a' }] }).resolve(access, { at, capability: 'physiology.self.read' }), { status: 'denied' })
})
