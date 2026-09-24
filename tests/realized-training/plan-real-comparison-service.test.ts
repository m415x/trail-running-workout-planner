import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildAthletePlanRealComparison,
} from '@/lib/realized-training/plan-real-comparison-service'
import type { PlannedSessionComparisonInput } from '@/lib/realized-training/plan-real-comparison'
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
      elevationGainM: { state: 'known', value: 300, unit: 'm' },
      intensity: { state: 'unknown', reason: 'not_prescribed', unit: null },
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
    status: 'completed',
    distanceKm: 10,
    durationMin: 60,
    elevationGainM: 300,
    avgHrBpm: null,
    rpe: null,
    loggedAt: '2026-09-10T20:00:00.000Z',
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM'],
    ...overrides,
  })
}

const window = {
  kind: 'week',
  startDate: '2026-09-07',
  endDate: '2026-09-13',
} as const

describe('longitudinal plan-real comparison service', () => {
  it('builds planned, unknown and unplanned items in deterministic order', () => {
    const result = buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window,
      plannedSessions: [
        planned(),
        planned({
          date: '2026-09-11',
          sessionId: 'session-2',
          sessionTitle: 'Recovery',
        }),
      ],
      realizedRecords: [
        realized(),
        realized({
          id: 'free-1',
          sessionId: null,
          date: '2026-09-09',
        }),
      ],
    })

    assert.deepEqual(result.items.map(item => [item.date, item.state]), [
      ['2026-09-09', 'unplanned_realized'],
      ['2026-09-10', 'matched'],
      ['2026-09-11', 'unknown'],
    ])
  })

  it('filters cross-team, cross-athlete and out-of-window inputs', () => {
    const result = buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window,
      plannedSessions: [
        planned(),
        planned({ teamId: 'team-2', sessionId: 'cross-team' }),
        planned({ athleteId: 'athlete-2', sessionId: 'cross-athlete' }),
        planned({ date: '2026-09-20', sessionId: 'outside' }),
      ],
      realizedRecords: [
        realized(),
        realized({ id: 'cross-team-log', teamId: 'team-2', sessionId: null }),
        realized({ id: 'cross-athlete-log', athleteId: 'athlete-2', sessionId: null }),
        realized({ id: 'outside-log', date: '2026-09-20', sessionId: null }),
      ],
    })

    assert.deepEqual(result.items.map(item => item.kind === 'planned_session'
      ? item.sessionId
      : item.realized.recordId), ['session-1'])
  })

  it('does not match realized evidence by date, title, or workout when the authoritative session link differs', () => {
    const result = buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window,
      plannedSessions: [planned({
        sessionId: 'session-planned',
        sessionTitle: 'Trail',
        metrics: {
          ...planned().metrics,
          durationMin: { state: 'known', value: 90, unit: 'min' },
        },
      })],
      realizedRecords: [realized({
        id: 'same-looking-realized',
        sessionId: 'different-session',
        workoutId: 'same-workout',
        date: '2026-09-10',
        durationMin: 90,
      })],
    })
    const item = result.items[0]

    assert.equal(item.kind, 'planned_session')
    assert.equal(item.state, 'unknown')
    assert.equal(item.realized, null)
    const duration = item.metrics.find(metric => metric.name === 'durationMin')
    assert.equal(duration?.evaluation.state, 'not_evaluated')
    assert.equal(
      duration?.evaluation.state === 'not_evaluated'
        ? duration.evaluation.reason
        : null,
      'not_observed',
    )
  })

  it('does not choose silently between multiple authoritative rows for one session', () => {
    const result = buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window,
      plannedSessions: [planned()],
      realizedRecords: [
        realized({ id: 'log-a' }),
        realized({ id: 'log-b' }),
      ],
    })
    const item = result.items[0]

    assert.equal(item.state, 'unknown')
    assert.ok(item.limitations.includes('multiple_authoritative_realized_records'))
    assert.ok(item.limitations.includes('conflicting_record:log-a'))
    assert.ok(item.limitations.includes('conflicting_record:log-b'))
  })

  it('preserves planning resolution limitations', () => {
    const result = buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window,
      plannedSessions: [],
      realizedRecords: [],
      planningLimitations: [{
        date: '2026-09-10',
        status: 'conflict',
        reason: 'overlapping-cohorts',
        conflictingIds: ['membership-1', 'membership-2'],
      }],
    })

    assert.deepEqual(result.planningLimitations[0].conflictingIds, [
      'membership-1',
      'membership-2',
    ])
  })

  it('rejects invalid or reversed windows', () => {
    assert.throws(() => buildAthletePlanRealComparison({
      teamId: 'team-1',
      athleteId: 'athlete-1',
      window: { kind: 'week', startDate: '2026-09-14', endDate: '2026-09-07' },
      plannedSessions: [],
      realizedRecords: [],
    }), RangeError)
  })
})
