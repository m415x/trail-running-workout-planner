import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  comparePlannedSession,
  projectUnplannedRealized,
  type PlannedSessionComparisonInput,
} from '@/lib/realized-training/plan-real-comparison'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import type { RawRealizedTrainingRecord } from '@/types'

function planned(
  overrides: Partial<PlannedSessionComparisonInput> = {},
): PlannedSessionComparisonInput {
  return {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    date: '2026-09-10',
    sessionId: 'session-1',
    sessionTitle: 'Trail',
    planning: {
      source: 'group',
      teamId: 'team-1',
      groupId: 'group-1',
      planId: 'plan-1',
      cohortId: null,
    },
    metrics: {
      distanceKm: { state: 'known', value: 10, unit: 'km' },
      durationMin: { state: 'known', value: 60, unit: 'min' },
      elevationGainM: { state: 'known', value: 0, unit: 'm' },
      intensity: { state: 'known', value: 'Z2', unit: 'hr_zone' },
    },
    ...overrides,
  }
}

function realized(
  overrides: Partial<RawRealizedTrainingRecord> = {},
) {
  return normalizeRealizedTrainingRecord({
    id: 'log-1',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: 'session-1',
    workoutId: null,
    date: '2026-09-10',
    performedAt: '2026-09-10T18:00:00-03:00',
    status: 'completed',
    distanceKm: 10,
    durationMin: 60,
    elevationGainM: 0,
    avgHrBpm: null,
    rpe: 5,
    loggedAt: '2026-09-10T22:00:00.000Z',
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM', 'rpe'],
    ...overrides,
  })
}

describe('plan-real comparison', () => {
  it('matches known compatible dimensions without fabricating intensity equivalence', () => {
    const result = comparePlannedSession(planned(), realized())

    assert.equal(result.state, 'matched')
    assert.equal(result.metrics[0].evaluation.state, 'matched')
    assert.equal(result.metrics[3].evaluation.state, 'not_evaluated')
    assert.equal(
      result.metrics[3].evaluation.state === 'not_evaluated'
        ? result.metrics[3].evaluation.reason
        : null,
      'unsupported_intensity_pair',
    )
  })

  it('calculates absolute and relative differences only for comparable known values', () => {
    const result = comparePlannedSession(
      planned(),
      realized({ distanceKm: 12, durationMin: 75 }),
    )
    const distance = result.metrics.find(metric => metric.name === 'distanceKm')

    assert.equal(result.state, 'deviation')
    assert.equal(distance?.evaluation.state, 'deviation')
    assert.equal(distance?.evaluation.absoluteDelta, 2)
    assert.equal(distance?.evaluation.relativeDeltaPercent, 20)
  })

  it('preserves unknown realized metrics instead of converting them to zero', () => {
    const result = comparePlannedSession(
      planned(),
      realized({
        durationMin: 0,
        knownMetricFields: ['distanceKm', 'elevationGainM', 'rpe'],
      }),
    )
    const duration = result.metrics.find(metric => metric.name === 'durationMin')

    assert.equal(duration?.evaluation.state, 'not_evaluated')
    assert.equal(
      duration?.evaluation.state === 'not_evaluated'
        ? duration.evaluation.reason
        : null,
      'not_recorded',
    )
  })

  it('keeps a known zero baseline comparable but leaves its relative delta undefined', () => {
    const result = comparePlannedSession(
      planned(),
      realized({ elevationGainM: 25 }),
    )
    const elevation = result.metrics.find(metric => metric.name === 'elevationGainM')

    assert.equal(elevation?.evaluation.state, 'deviation')
    assert.equal(elevation?.evaluation.absoluteDelta, 25)
    assert.equal(elevation?.evaluation.relativeDeltaPercent, null)
  })

  it('treats missing evidence as unknown and explicit missed evidence as known not completed', () => {
    assert.equal(comparePlannedSession(planned(), null).state, 'unknown')
    assert.equal(comparePlannedSession(
      planned(),
      realized({
        status: 'missed',
        distanceKm: 0,
        durationMin: 0,
        elevationGainM: 0,
        rpe: 0,
        knownMetricFields: [],
      }),
    ).state, 'known_not_completed')
  })

  it('rejects a cross-athlete or non-authoritative session link', () => {
    assert.equal(comparePlannedSession(
      planned(),
      realized({ athleteId: 'athlete-2' }),
    ).state, 'unknown')
    assert.equal(comparePlannedSession(
      planned(),
      realized({ sessionId: null }),
    ).state, 'unknown')
  })

  it('keeps a free workout independent from prescribed sessions', () => {
    const result = projectUnplannedRealized(realized({ sessionId: null }))

    assert.equal(result.state, 'unplanned_realized')
    assert.equal(result.kind, 'unplanned_realized')
    assert.ok(result.metrics.every(metric => metric.evaluation.state === 'not_evaluated'))
  })
})
