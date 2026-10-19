import assert from 'node:assert/strict'
import test from 'node:test'

import { createH5aSelfContextBoundary } from '@/lib/authorization/h5a-self-context'

const at = '2026-10-17T15:00:00.000Z'
const access = { status: 'authenticated', userId: 'user_a' } as const
const membership = (overrides: Record<string, unknown> = {}) => ({
  userId: 'user_a',
  teamId: 'team_1',
  preset: 'athlete' as const,
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null,
  isActive: true,
  ...overrides,
})
const profile = (overrides: Record<string, unknown> = {}) => ({
  id: 'athlete_a',
  userId: 'user_a',
  teamId: 'team_1',
  ...overrides,
})
const boundary = (options: {
  team?: { status: string; teamId?: string }
  memberships?: ReturnType<typeof membership>[]
  profiles?: ReturnType<typeof profile>[]
} = {}) => createH5aSelfContextBoundary({
  resolveActiveTeam: async () => options.team ?? { status: 'resolved', teamId: 'team_1' },
  loadMemberships: async () => options.memberships ?? [membership()],
  loadAthleteProfiles: async () => options.profiles ?? [profile()],
})

for (const capability of ['physiology.biometric.self.read', 'physiology.biometric.self.manage'] as const) {
  test('KAN-646/T5 biometric ' + capability + ' allows only own resolved Team/profile', async () => {
    assert.deepEqual(await boundary().resolve(access, { at, capability }), {
      status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a',
    })
  })

  test('KAN-646/T5 biometric ' + capability + ' denies absent/invalid auth and unresolved Team', async () => {
    assert.deepEqual(await boundary().resolve({ status: 'forbidden', reason: 'anonymous' }, { at, capability }), { status: 'denied' })
    assert.deepEqual(await boundary({ team: { status: 'selection_required' } }).resolve(access, { at, capability }), { status: 'denied' })
    assert.deepEqual(await boundary({ team: { status: 'denied' } }).resolve(access, { at, capability }), { status: 'denied' })
  })

  test('KAN-646/T5 biometric ' + capability + ' denies expired/revoked/ambiguous memberships', async () => {
    for (const memberships of [
      [], [membership({ isActive: false })],
      [membership({ effectiveUntil: '2026-10-16T00:00:00.000Z' })],
      [membership(), membership()],
      [membership({ teamId: 'team_2' })],
    ]) {
      assert.deepEqual(await boundary({ memberships }).resolve(access, { at, capability }), { status: 'denied' })
    }
  })

  test('KAN-646/T5 biometric ' + capability + ' denies another athlete and conflicting SELF profiles', async () => {
    for (const profiles of [
      [], [profile({ userId: 'user_b' })], [profile({ teamId: 'team_2' })],
      [profile(), profile({ id: 'athlete_duplicate' })],
    ]) {
      assert.deepEqual(await boundary({ profiles }).resolve(access, { at, capability }), { status: 'denied' })
    }
  })
}
