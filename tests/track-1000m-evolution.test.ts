import assert from 'node:assert/strict'
import test from 'node:test'

import { projectTrack1000mEvolutionSeries } from '@/lib/analytics/training/track-1000m-evolution'
import type { FieldPerformanceTestRow } from '@/lib/physiology/field-performance-test-history'

function row(overrides: Partial<FieldPerformanceTestRow> = {}): FieldPerformanceTestRow {
  return {
    id: 'test_1',
    athleteId: 'athlete_1',
    performedAt: '2026-07-31',
    protocol: '1000m_track',
    source: 'coach_manual',
    distanceM: 1000,
    elapsedTimeSec: 240,
    notes: null,
    isDeleted: false,
    createdAt: '2026-07-31T12:00:00.000Z',
    updatedAt: '2026-07-31T12:00:00.000Z',
    ...overrides,
  }
}

test('projects only active athlete evidence into deterministic factual points', () => {
  const rows: FieldPerformanceTestRow[] = [
    row({ id: 'later', performedAt: '2026-08-28', elapsedTimeSec: 230, createdAt: '2026-08-28T12:00:00.000Z' }),
    row({ id: 'invalidated', performedAt: '2026-07-31', elapsedTimeSec: 245, isDeleted: true }),
    row({ id: 'other-athlete', athleteId: 'athlete_2', performedAt: '2026-06-30', elapsedTimeSec: 250 }),
    row({ id: 'earlier', performedAt: '2026-07-31', elapsedTimeSec: 240 }),
  ]

  assert.deepEqual(projectTrack1000mEvolutionSeries(rows, 'athlete_1'), [
    {
      evaluationId: 'earlier',
      performedAt: '2026-07-31',
      protocol: '1000m_track',
      elapsedTimeSec: 240,
      paceSecPerKm: 240,
      averageSpeedKmh: 15,
    },
    {
      evaluationId: 'later',
      performedAt: '2026-08-28',
      protocol: '1000m_track',
      elapsedTimeSec: 230,
      paceSecPerKm: 230,
      averageSpeedKmh: 15.65,
    },
  ])
})

test('returns an empty series when the athlete has no active evidence', () => {
  assert.deepEqual(
    projectTrack1000mEvolutionSeries([
      row({ athleteId: 'athlete_2' }),
      row({ id: 'deleted', isDeleted: true }),
    ], 'athlete_1'),
    [],
  )
})
