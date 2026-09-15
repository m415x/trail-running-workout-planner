import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { summarizeRealizedTraining } from '@/lib/analytics/training/training-analytics'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

function record(
  id: string,
  metrics: Partial<Record<'distanceKm' | 'durationMin' | 'elevationGainM', number>>,
): RealizedTrainingRecord {
  const metric = (name: 'distanceKm' | 'durationMin' | 'elevationGainM') =>
    name in metrics
      ? ({ state: 'known', value: metrics[name]! } as const)
      : ({ state: 'unknown', reason: 'not_recorded' } as const)

  return {
    id,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: null,
    workoutId: null,
    date: '2026-09-10',
    status: 'completed',
    metrics: {
      distanceKm: metric('distanceKm'),
      durationMin: metric('durationMin'),
      elevationGainM: metric('elevationGainM'),
      avgHrBpm: { state: 'unknown', reason: 'not_recorded' },
      rpe: { state: 'unknown', reason: 'not_recorded' },
    },
    provenance: {
      source: 'manual',
      sourceActivityId: null,
      loggedAt: '2026-09-10T12:00:00.000Z',
      sessionLink: 'none',
    },
    quality: 'usable',
    limitations: [],
  }
}

describe('realized training analytics', () => {
  it('aggregates only explicit realized evidence and preserves metric coverage', () => {
    const result = summarizeRealizedTraining([
      record('r1', { distanceKm: 10, durationMin: 60, elevationGainM: 500 }),
      record('r2', { distanceKm: 0, durationMin: 45 }),
    ])

    assert.equal(result.frequency.state, 'available')
    if (result.frequency.state !== 'available') assert.fail('frequency should be available')
    assert.equal(result.frequency.value, 2)

    assert.equal(result.distance.state, 'available')
    if (result.distance.state !== 'available') assert.fail('distance should be available')
    assert.equal(result.distance.value, 10)
    assert.equal(result.distance.knownRecords, 2)

    assert.equal(result.duration.state, 'available')
    if (result.duration.state !== 'available') assert.fail('duration should be available')
    assert.equal(result.duration.value, 105)

    assert.equal(result.elevation.state, 'available')
    if (result.elevation.state !== 'available') assert.fail('elevation should be available')
    assert.equal(result.elevation.value, 500)
    assert.equal(result.elevation.knownRecords, 1)
  })

  it('does not turn absent realized rows into missed workouts', () => {
    const result = summarizeRealizedTraining([])

    assert.deepEqual(result.frequency, { state: 'unknown', reason: 'no_realized_evidence' })
    assert.deepEqual(result.distance, {
      state: 'unknown',
      reason: 'no_realized_evidence',
      knownRecords: 0,
      observedRecords: 0,
    })
  })

  it('does not turn unknown metric evidence into zero', () => {
    const result = summarizeRealizedTraining([record('r1', { durationMin: 30 })])

    assert.deepEqual(result.distance, {
      state: 'unknown',
      reason: 'metric_not_observed',
      knownRecords: 0,
      observedRecords: 1,
    })
  })
})
