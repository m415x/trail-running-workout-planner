import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { createH5aSelfContextBoundary } from '@/lib/authorization/h5a-self-context'

const source = readFileSync('lib/authorization/h5a-self-next-server.ts', 'utf8')

test('KAN-697 Next server SELF composition reuses validated active-Team and persisted H3 evidence', () => {
  assert.match(source, /createActiveTeamNextServerContext/)
  assert.match(source, /createH4aNextServerEvidenceSource/)
  assert.match(source, /createH5aSelfContextBoundary/)
  assert.doesNotMatch(source, /CURRENT_USER_ID|CURRENT_ATHLETE_PROFILE_ID|team_1|profile_user_1/)
})

test('KAN-697 SELF boundary authorizes requested planning or workout-log capability without conflation', async () => {
  const boundary = createH5aSelfContextBoundary({
    resolveActiveTeam: async () => ({ status: 'resolved' as const, teamId: 'team-a' }),
    loadMemberships: async () => [{
      userId: 'user-a', teamId: 'team-a', preset: 'coach' as const,
      isActive: true, effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: null,
    }],
    loadAthleteProfiles: async () => [{ id: 'athlete-a', userId: 'user-a', teamId: 'team-a' }],
  })
  const access = { status: 'authenticated' as const, userId: 'user-a' }
  const at = '2026-10-09T12:00:00.000Z'
  for (const capability of ['planning.self.read', 'workout_log.self.manage'] as const) {
    const result = await boundary.resolve(access, { at, capability })
    assert.deepEqual(result, {
      status: 'resolved', userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a',
    }, capability)
  }
  const invalid = await boundary.resolve(access, { at, capability: 'planning.manage' as 'planning.self.read' })
  assert.deepEqual(invalid, { status: 'denied' }, 'Coach planning capability cannot stand in for SELF')
})
