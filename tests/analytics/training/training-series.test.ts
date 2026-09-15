import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { projectRealizedTrainingSeries } from '@/lib/analytics/training/training-series'
import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

function record(
  id: string,
  date: string,
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
    date,
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
      loggedAt: `${date}T12:00:00.000Z`,
      sessionLink: 'none',
    },
    quality: 'usable',
    limitations: [],
  }
}

describe('realized training series', () => {
  it('uses only actual realized dates and does not invent missing days', () => {
    const result = projectRealizedTrainingSeries([
      record('r1', '2026-09-10', { distanceKm: 8, durationMin: 50, elevationGainM: 300 }),
      record('r2', '2026-09-12', { distanceKm: 12, durationMin: 70, elevationGainM: 600 }),
    ])

    assert.deepEqual(result.map(point => point.date), ['2026-09-10', '2026-09-12'])
    assert.equal(result[0]?.distanceKm, 8)
    assert.equal(result[1]?.elevationGainM, 600)
  })

  it('preserves unknown metric evidence as null instead of zero', () => {
    const result = projectRealizedTrainingSeries([
      record('r1', '2026-09-10', { durationMin: 45 }),
    ])

    assert.deepEqual(result, [{
      date: '2026-09-10',
      sessions: 1,
      distanceKm: null,
      durationMin: 45,
      elevationGainM: null,
    }])
  })

  it('aggregates multiple realized records that share the same actual date', () => {
    const result = projectRealizedTrainingSeries([
      record('r1', '2026-09-10', { distanceKm: 8, durationMin: 50 }),
      record('r2', '2026-09-10', { distanceKm: 4, elevationGainM: 200 }),
    ])

    assert.deepEqual(result, [{
      date: '2026-09-10',
      sessions: 2,
      distanceKm: 12,
      durationMin: 50,
      elevationGainM: 200,
    }])
  })
})
