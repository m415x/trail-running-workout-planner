import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  comparePlannedAndRealizedLoad,
  evaluateReadinessContinuity,
} from '@/lib/readiness/continuity-and-adherence'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import { H12_READINESS_POLICY_DRAFT_V1 } from '@/lib/readiness/readiness-policy'
import type {
  RawRealizedTrainingRecord,
  RecentPreparationSummary,
} from '@/types'

function realized(id: string, input: {
  sessionId?: string | null
  distanceKm?: number
  durationMin?: number
  elevationGainM?: number
} = {}) {
  const sessionId = input.sessionId === undefined ? `session-${id}` : input.sessionId
  const raw: RawRealizedTrainingRecord = {
    id,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId,
    workoutId: null,
    date: '2026-09-10',
    status: 'completed',
    distanceKm: input.distanceKm ?? 10,
    durationMin: input.durationMin ?? 60,
    elevationGainM: input.elevationGainM ?? 300,
    avgHrBpm: null,
    rpe: 5,
    loggedAt: '2026-09-10T20:00:00.000Z',
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: ['distanceKm', 'durationMin', 'elevationGainM', 'rpe'],
  }
  return normalizeRealizedTrainingRecord(raw)
}

function summary(activeRatio: number | null): RecentPreparationSummary {
  const unknown = {
    state: 'unknown' as const,
    unit: 'km' as const,
    sampleSize: 0,
    coverageRatio: 0,
    reason: 'insufficient_data' as const,
  }
  return {
    teamId: 'team-1',
    athleteId: 'athlete-1',
    window: { startDate: '2026-09-01', endDate: '2026-09-28', windowDays: 28, bucketDays: 7 },
    dataStatus: activeRatio === null ? 'insufficient_data' : 'sufficient',
    performedRecords: 6,
    volume: { totalKm: unknown, averageWeeklyKm: { ...unknown, unit: 'km_per_week' } },
    duration: {
      totalMin: { ...unknown, unit: 'min' },
      averageWeeklyMin: { ...unknown, unit: 'min_per_week' },
    },
    elevation: {
      totalGainM: { ...unknown, unit: 'm' },
      averageWeeklyGainM: { ...unknown, unit: 'm_per_week' },
    },
    frequency: { recordedSessionsPerWeek: { ...unknown, unit: 'sessions_per_week' } },
    intensity: {
      averageRpe: { ...unknown, unit: 'rpe' },
      averageHrBpm: { ...unknown, unit: 'bpm' },
    },
    longRun: {
      longestDistanceKm: unknown,
      longestDurationMin: { ...unknown, unit: 'min' },
    },
    continuity: {
      activeBucketRatio: activeRatio === null
        ? { ...unknown, unit: 'ratio' }
        : { state: 'known', value: activeRatio, unit: 'ratio', sampleSize: 3, coverageRatio: 1 },
      activeBuckets: 3,
      totalBuckets: 4,
    },
    limitations: [],
  }
}

describe('continuity and plan-real indicators', () => {
  it('detecta continuidad por debajo del umbral configurable', () => {
    const indicator = evaluateReadinessContinuity({
      summary: summary(0.5),
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })
    assert.equal(indicator.status, 'below_threshold')
  })

  it('no evalúa continuidad con información insuficiente', () => {
    const indicator = evaluateReadinessContinuity({
      summary: summary(null),
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })
    assert.equal(indicator.status, 'insufficient_data')
  })

  it('compara plan-real sólo con Session explícitamente vinculada', () => {
    const policy = {
      ...H12_READINESS_POLICY_DRAFT_V1,
      planVsReal: { minimumLinkedSessions: 2, relativeDeviationThreshold: 0.3 },
    }
    const result = comparePlannedAndRealizedLoad({
      pairs: [
        {
          planned: { sessionId: 'session-a', distanceKm: 10, durationMin: 60, elevationGainM: 300 },
          realized: realized('a', { sessionId: 'session-a', distanceKm: 7 }),
        },
        {
          planned: { sessionId: 'session-b', distanceKm: 10, durationMin: 60, elevationGainM: 300 },
          realized: realized('b', { sessionId: 'session-b', distanceKm: 7 }),
        },
        {
          planned: { sessionId: 'session-c', distanceKm: 100, durationMin: 600, elevationGainM: 3000 },
          realized: realized('c', { sessionId: null, distanceKm: 1 }),
        },
      ],
      policy,
    })

    assert.equal(result.linkedSessions, 2)
    assert.equal(result.distanceKm.status, 'assessed')
    if (result.distanceKm.status !== 'assessed') return
    assert.equal(result.distanceKm.plannedTotal, 20)
    assert.equal(result.distanceKm.realizedTotal, 14)
    assert.equal(result.distanceKm.exceedsThreshold, true)
  })

  it('devuelve insufficient_data si faltan pares vinculados suficientes', () => {
    const result = comparePlannedAndRealizedLoad({
      pairs: [{
        planned: { sessionId: 'session-a', distanceKm: 10, durationMin: 60, elevationGainM: 300 },
        realized: realized('a', { sessionId: 'session-a' }),
      }],
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.distanceKm.status, 'insufficient_data')
  })
})
