import assert from 'node:assert/strict'
import test from 'node:test'
import { createManualSelfCorrectionBoundary } from '@/lib/realized-training/manual-self-correction-boundary'

const replacement = {
  sessionId: null, workoutId: null, date: '2026-10-09',
  performedAt: '2026-10-09T08:00:00-03:00', status: 'completed' as const,
  metrics: {
    distanceKm: { state: 'unknown' as const }, durationMin: { state: 'unknown' as const },
    elevationGainM: { state: 'unknown' as const }, avgHrBpm: { state: 'unknown' as const },
    rpe: { state: 'unknown' as const },
  },
  feeling: null, athleteNotes: null,
}

function fixture(options: { denied?: boolean; effective?: boolean } = {}) {
  const writes: unknown[] = []
  const calls: string[] = []
  const boundary = createManualSelfCorrectionBoundary({
    resolveSelf: async (_access, request) => {
      calls.push('self:' + request.capability)
      return options.denied ? { status: 'denied' as const } : {
        status: 'resolved' as const, userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a',
      }
    },
    resolveEffectiveSession: async (_access, sessionId) => {
      calls.push('effective:' + sessionId)
      return options.effective === false ? { status: 'denied' as const } : {
        status: 'resolved' as const, athleteProfileId: 'athlete-a', sessionId,
      }
    },
    persist: (input) => {
      writes.push(input)
      return { id: 'log-a' }
    },
  })
  return { boundary, writes, calls }
}

test('KAN-702 correction denied H2/SELF never mutates or audits a log', async () => {
  for (const denied of [true, false]) {
    const { boundary, writes, calls } = fixture({ denied })
    const access = denied
      ? { status: 'authenticated' as const, userId: 'user-a' }
      : { status: 'forbidden' as const, reason: 'anonymous' as const }
    const outcome = await boundary.correct(access, { workoutLogId: 'log-a', reason: null, replacement }, '2026-10-09T12:00:00Z')
    assert.equal(outcome.success, false)
    assert.deepEqual(writes, [])
    if (denied) assert.deepEqual(calls, ['self:workout_log.self.manage'])
    else assert.deepEqual(calls, [])
  }
})

test('KAN-702 free correction derives owner AND audit actor and skips planning', async () => {
  const { boundary, writes, calls } = fixture()
  const outcome = await boundary.correct(
    { status: 'authenticated', userId: 'user-a' },
    { workoutLogId: 'log-a', reason: 'correct distance', replacement },
    '2026-10-09T12:00:00Z',
  )
  assert.equal(outcome.success, true)
  assert.deepEqual(calls, ['self:workout_log.self.manage'])
  assert.equal((writes[0] as { athleteId: string }).athleteId, 'athlete-a')
  assert.equal((writes[0] as { correctedByUserId: string }).correctedByUserId, 'user-a')
})

test('KAN-702 non-effective replacement session and unverified free workout cannot mutate or audit', async () => {
  for (const replacementOverride of [{ sessionId: 'foreign-session' }, { workoutId: 'foreign-workout' }]) {
    const { boundary, writes } = fixture({ effective: false })
    const outcome = await boundary.correct(
      { status: 'authenticated', userId: 'user-a' },
      { workoutLogId: 'log-a', reason: null, replacement: { ...replacement, ...replacementOverride } },
      '2026-10-09T12:00:00Z',
    )
    assert.equal(outcome.success, false)
    assert.deepEqual(writes, [])
  }
})
