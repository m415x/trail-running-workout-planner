import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assessLongRunConcentration,
  assessPredictedSessionJump,
} from '@/lib/readiness/session-jump-and-long-run'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import { H12_READINESS_POLICY_DRAFT_V1 } from '@/lib/readiness/readiness-policy'
import type { RawRealizedTrainingRecord } from '@/types'

function realized(id: string, date: string, distanceKm: number, durationMin: number, elevationGainM: number | null = 300) {
  const raw: RawRealizedTrainingRecord = {
    id,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: `session-${id}`,
    workoutId: null,
    date,
    status: 'completed',
    distanceKm,
    durationMin,
    elevationGainM,
    avgHrBpm: null,
    rpe: 5,
    loggedAt: `${date}T20:00:00.000Z`,
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: [
      'distanceKm',
      'durationMin',
      ...(elevationGainM === null ? [] : ['elevationGainM'] as const),
      'rpe',
    ],
  }
  return normalizeRealizedTrainingRecord(raw)
}

describe('session jump and long-run concentration', () => {
  it('detecta una sesión prevista muy superior al máximo reciente comparable', () => {
    const result = assessPredictedSessionJump({
      planned: { sessionId: 'future', distanceKm: 24, durationMin: 160, elevationGainM: 900 },
      comparableSessions: {
        basis: 'session_type',
        records: [
          realized('a', '2026-09-01', 12, 80, 400),
          realized('b', '2026-09-08', 14, 90, 450),
          realized('c', '2026-09-15', 15, 95, 500),
          realized('d', '2026-09-22', 16, 100, 550),
        ],
      },
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.distanceKm.status, 'assessed')
    if (result.distanceKm.status !== 'assessed') return
    assert.equal(result.distanceKm.recentReferenceMax, 16)
    assert.equal(result.distanceKm.increaseRatio, 0.5)
    assert.equal(result.distanceKm.exceedsThreshold, true)
  })

  it('no inventa un salto para una dimensión desconocida', () => {
    const result = assessPredictedSessionJump({
      planned: { sessionId: 'future', distanceKm: 20, durationMin: 120, elevationGainM: 1000 },
      comparableSessions: {
        basis: 'coach_selected',
        records: [
          realized('a', '2026-09-08', 15, 90, null),
          realized('b', '2026-09-15', 16, 100, null),
        ],
      },
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.elevationGainM.status, 'insufficient_data')
  })

  it('detecta concentración de distancia y duración de la tirada larga', () => {
    const result = assessLongRunConcentration({
      weekRecords: [
        realized('a', '2026-09-21', 5, 35),
        realized('b', '2026-09-23', 6, 40),
        realized('c', '2026-09-26', 14, 100),
      ],
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.distance.status, 'assessed')
    assert.equal(result.duration.status, 'assessed')
    if (result.distance.status !== 'assessed') return
    assert.equal(result.distance.weeklyTotal, 25)
    assert.equal(result.distance.ratio, 14 / 25)
    assert.equal(result.distance.exceedsThreshold, true)
  })

  it('no calcula concentración si una sesión realizada carece de la métrica', () => {
    const withUnknownDistance = realized('c', '2026-09-26', 14, 100)
    const modified = {
      ...withUnknownDistance,
      metrics: {
        ...withUnknownDistance.metrics,
        distanceKm: { state: 'unknown' as const, reason: 'not_recorded' as const },
      },
    }
    const result = assessLongRunConcentration({
      weekRecords: [
        realized('a', '2026-09-21', 5, 35),
        realized('b', '2026-09-23', 6, 40),
        modified,
      ],
      policy: H12_READINESS_POLICY_DRAFT_V1,
    })

    assert.equal(result.distance.status, 'insufficient_data')
  })
})
