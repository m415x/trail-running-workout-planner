import assert from 'node:assert/strict'
import test from 'node:test'

import { createH5aEffectiveSessionBoundary } from '@/lib/athlete-planning/effective-self-session-boundary'

const at = '2026-10-09T12:00:00.000Z'
const plan = {
  id: 'plan-a', groupId: 'group-a', planningCohortId: null,
  status: 'active' as const, isDeleted: false,
  macrocycles: [{ startDate: '2026-10-01', endDate: '2026-10-31', isDeleted: false }],
}
function setup(options: { effective?: boolean; profile?: string; team?: string } = {}) {
  const calls: string[] = []
  const boundary = createH5aEffectiveSessionBoundary({
    resolveSelf: async (_access, request) => {
      calls.push('self:' + request.capability)
      return { status: 'resolved' as const, userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a' }
    },
    loadSessionEvidence: async (self, sessionId) => {
      calls.push('evidence:' + self.athleteProfileId + ':' + sessionId)
      return {
        athleteId: options.profile ?? 'athlete-a',
        athleteTeamId: 'team-a',
        currentGroupId: 'group-a', groupChanges: [], memberships: [], basePlans: [plan],
        session: { id: sessionId, teamId: options.team ?? 'team-a', date: '2026-10-09', isDeleted: false },
        prescriptions: options.effective === false ? [{
          id: 'other', sessionId: 'another-session', groupId: 'group-a', microcycleId: 'micro-a', groupTrainingPlanId: 'plan-a',
        }] : [{
          id: 'prescription-a', sessionId, groupId: 'group-a', microcycleId: 'micro-a', groupTrainingPlanId: 'plan-a',
        }],
      }
    },
  })
  return { boundary, calls }
}

test('KAN-700 H5A session lookup uses authenticated SELF and persisted effective prescription, not client athlete ID', async () => {
  const { boundary, calls } = setup()
  assert.deepEqual(await boundary.resolve(
    { status: 'authenticated', userId: 'user-a' },
    { at, sessionId: 'session-a' },
  ), { status: 'resolved', athleteProfileId: 'athlete-a', sessionId: 'session-a', prescriptionId: 'prescription-a' })
  assert.deepEqual(calls, ['self:planning.self.read', 'evidence:athlete-a:session-a'])
})

test('KAN-700 session boundary denies same-Team non-effective sessions, foreign profiles, and foreign teams', async () => {
  for (const options of [{ effective: false }, { profile: 'athlete-b' }, { team: 'team-b' }]) {
    const { boundary } = setup(options)
    assert.deepEqual(await boundary.resolve(
      { status: 'authenticated', userId: 'user-a' }, { at, sessionId: 'session-a' },
    ), { status: 'denied' })
  }
})

test('KAN-700 unauthenticated request never invokes SELF resolution or DB reads', async () => {
  const { boundary, calls } = setup()
  assert.deepEqual(await boundary.resolve(
    { status: 'forbidden', reason: 'anonymous' }, { at, sessionId: 'session-a' },
  ), { status: 'denied' })
  assert.deepEqual(calls, [])
})
