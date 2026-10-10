import assert from 'node:assert/strict'
import test from 'node:test'

import { createManualSelfCaptureBoundary } from '@/lib/realized-training/manual-self-capture-boundary'
import { createManualSelfCorrectionBoundary } from '@/lib/realized-training/manual-self-correction-boundary'
import type { ManualRealizedTrainingClientInput } from '@/types/training/realized-training-capture.types'

const access = { status: 'authenticated' as const, userId: 'user_a' }
const self = { status: 'resolved' as const, userId: 'user_a', teamId: 'team_a', athleteProfileId: 'athlete_a' }
const input: ManualRealizedTrainingClientInput = {
  sessionId: null, workoutId: null, date: '2026-10-09',
  performedAt: '2026-10-09T12:00:00-03:00', status: 'completed',
  metrics: { distanceKm: { state: 'unknown' }, durationMin: { state: 'unknown' }, elevationGainM: { state: 'unknown' }, avgHrBpm: { state: 'unknown' }, rpe: { state: 'unknown' } },
  feeling: null, athleteNotes: null,
}

for (const status of ['blocked', 'unavailable'] as const) {
  test('KAN-721 ' + status + ' blocks both SELF writes before sessions and durable side effects', async () => {
    const calls: string[] = []
    const deps = {
      resolveSelf: async () => self,
      resolveEffectiveSession: async () => { calls.push('session'); return { status: 'denied' as const } },
      evaluateEconomicAccess: async (subject: { teamId: string; athleteProfileId: string }) => {
        assert.deepEqual(subject, { teamId: 'team_a', athleteProfileId: 'athlete_a' })
        return { status }
      },
      persist: () => { calls.push('persist'); return { id: 'new' } },
    }
    const create = createManualSelfCaptureBoundary(deps)
    const correct = createManualSelfCorrectionBoundary(deps)
    assert.equal((await create.create(access, input, '2026-10-09T15:00:00Z')).success, false)
    assert.equal((await correct.correct(access, { workoutLogId: 'log_a', replacement: input, reason: null }, '2026-10-09T15:00:00Z')).success, false)
    assert.deepEqual(calls, [])
  })
}

test('KAN-721 allowed economic decision retains existing H5A SELF persistence contract', async () => {
  const writes: string[] = []
  const deps = {
    resolveSelf: async () => self,
    resolveEffectiveSession: async () => ({ status: 'denied' as const }),
    evaluateEconomicAccess: async () => ({ status: 'allowed' as const }),
    persist: () => { writes.push('write'); return { id: 'record' } },
  }
  const create = createManualSelfCaptureBoundary(deps)
  const correct = createManualSelfCorrectionBoundary(deps)
  assert.equal((await create.create(access, input, '2026-10-09T15:00:00Z')).success, true)
  assert.equal((await correct.correct(access, { workoutLogId: 'log_a', replacement: input, reason: null }, '2026-10-09T15:00:00Z')).success, true)
  assert.deepEqual(writes, ['write', 'write'])
})
