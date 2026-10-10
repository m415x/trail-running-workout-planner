import assert from 'node:assert/strict'
import test from 'node:test'

import { createManualSelfCaptureBoundary } from '@/lib/realized-training/manual-self-capture-boundary'

const freeInput = {
  sessionId: null, workoutId: null, date: '2026-10-09',
  performedAt: '2026-10-09T08:00:00-03:00', status: 'completed' as const,
  metrics: {
    distanceKm: { state: 'unknown' as const }, durationMin: { state: 'unknown' as const },
    elevationGainM: { state: 'unknown' as const }, avgHrBpm: { state: 'unknown' as const },
    rpe: { state: 'unknown' as const },
  },
  feeling: null, athleteNotes: null,
}

function setup(options: { authenticated?: boolean; self?: boolean; effective?: boolean } = {}) {
  const writes: unknown[] = []
  const events: string[] = []
  const boundary = createManualSelfCaptureBoundary({
    resolveSelf: async () => {
      events.push('self')
      return options.self === false ? { status: 'denied' as const } : {
        status: 'resolved' as const, userId: 'user-a', teamId: 'team-a', athleteProfileId: 'athlete-a',
      }
    },
    resolveEffectiveSession: async (_access, sessionId) => {
      events.push('session:' + sessionId)
      return options.effective === false ? { status: 'denied' as const } : {
        status: 'resolved' as const, athleteProfileId: 'athlete-a', sessionId, prescriptionId: 'prescription-a',
      }
    },
    evaluateEconomicAccess: async () => ({ status: 'allowed' as const }),
    persist: (input) => {
      events.push('write')
      writes.push(input)
      return { id: 'record-a' }
    },
  })
  return { boundary, writes, events }
}

test('KAN-701 free capture succeeds without planning lookup and uses the SELF owner', async () => {
  const { boundary, writes, events } = setup()
  const result = await boundary.create(
    { status: 'authenticated', userId: 'user-a' }, freeInput, '2026-10-09T12:00:00.000Z',
  )
  assert.deepEqual(result, { success: true, data: { id: 'record-a' } })
  assert.deepEqual(events, ['self', 'write'])
  assert.equal((writes[0] as { athleteId: string }).athleteId, 'athlete-a')
})

test('KAN-701 anonymous, denied SELF and non-effective session never write', async () => {
  for (const situation of ['anonymous', 'self-deny', 'session-deny'] as const) {
    const { boundary, writes } = setup({
      self: situation === 'self-deny' ? false : true,
      effective: situation === 'session-deny' ? false : true,
    })
    const access = situation === 'anonymous'
      ? { status: 'forbidden' as const, reason: 'anonymous' as const }
      : { status: 'authenticated' as const, userId: 'user-a' }
    const input = situation === 'session-deny' ? { ...freeInput, sessionId: 'session-b' } : freeInput
    assert.equal((await boundary.create(access, input, '2026-10-09T12:00:00.000Z')).success, false)
    assert.deepEqual(writes, [])
  }
})

test('KAN-701 free capture cannot launder an unverified workoutId into WorkoutLog', async () => {
  const { boundary, writes } = setup()
  const result = await boundary.create(
    { status: 'authenticated', userId: 'user-a' },
    { ...freeInput, workoutId: 'foreign-workout' }, '2026-10-09T12:00:00.000Z',
  )
  assert.equal(result.success, false)
  assert.deepEqual(writes, [])
})
