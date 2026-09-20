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


test('reports insufficient comparison until two observations are available', async () => {
  const { projectTrack1000mEvolution } = await import('@/lib/analytics/training/track-1000m-evolution')

  assert.deepEqual(projectTrack1000mEvolution([], 'athlete_1'), {
    series: [],
    comparison: {
      state: 'not_evaluable',
      currentValue: null,
      previousValue: null,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      direction: 'unknown',
      reason: 'current_insufficient_data',
    },
  })

  assert.deepEqual(projectTrack1000mEvolution([row()], 'athlete_1'), {
    series: projectTrack1000mEvolutionSeries([row()], 'athlete_1'),
    comparison: {
      state: 'not_evaluable',
      currentValue: 240,
      previousValue: null,
      absoluteDelta: null,
      relativeDeltaPercent: null,
      direction: 'unknown',
      reason: 'previous_insufficient_data',
    },
  })
})

test('compares the latest two active observations with factual mathematical direction', async () => {
  const { projectTrack1000mEvolution } = await import('@/lib/analytics/training/track-1000m-evolution')
  const rows = [
    row({ id: 'first', performedAt: '2026-06-30', elapsedTimeSec: 250, createdAt: '2026-06-30T12:00:00.000Z' }),
    row({ id: 'previous', performedAt: '2026-07-31', elapsedTimeSec: 240 }),
    row({ id: 'invalidated-latest', performedAt: '2026-08-15', elapsedTimeSec: 220, isDeleted: true, createdAt: '2026-08-15T12:00:00.000Z' }),
    row({ id: 'latest', performedAt: '2026-08-28', elapsedTimeSec: 230, createdAt: '2026-08-28T12:00:00.000Z' }),
  ]

  const evolution = projectTrack1000mEvolution(rows, 'athlete_1')

  assert.equal(evolution.series.at(-1)?.evaluationId, 'latest')
  assert.deepEqual(evolution.comparison, {
    state: 'available',
    currentValue: 230,
    previousValue: 240,
    absoluteDelta: -10,
    relativeDeltaPercent: (-10 / 240) * 100,
    direction: 'decreasing',
  })
})

test('reports stable when latest and previous elapsed times are equal', async () => {
  const { projectTrack1000mEvolution } = await import('@/lib/analytics/training/track-1000m-evolution')
  const evolution = projectTrack1000mEvolution([
    row({ id: 'previous', elapsedTimeSec: 240 }),
    row({ id: 'latest', performedAt: '2026-08-28', elapsedTimeSec: 240, createdAt: '2026-08-28T12:00:00.000Z' }),
  ], 'athlete_1')

  assert.equal(evolution.comparison.state, 'available')
  assert.equal(evolution.comparison.direction, 'stable')
  assert.equal(evolution.comparison.absoluteDelta, 0)
  assert.equal(evolution.comparison.relativeDeltaPercent, 0)
})
