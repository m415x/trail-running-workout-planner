import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import { buildRecentPreparationSummary } from '@/lib/readiness/recent-preparation-summary'
import type { RawRealizedTrainingRecord, ReadinessDataSufficiencyPolicy } from '@/types'

const policy: ReadinessDataSufficiencyPolicy = {
  lookbackDays: 28,
  bucketDays: 7,
  minimumPerformedSessions: 4,
  minimumActiveBuckets: 3,
  minimumMetricCoverageRatio: 0.75,
}

function realized(input: {
  id: string
  date: string
  distanceKm: number
  durationMin: number
  elevationGainM?: number | null
  avgHrBpm?: number | null
  rpe?: number | null
}) {
  const knownMetricFields: RawRealizedTrainingRecord['knownMetricFields'] = [
    'distanceKm',
    'durationMin',
    ...(input.elevationGainM === null ? [] : ['elevationGainM'] as const),
    ...(input.avgHrBpm == null ? [] : ['avgHrBpm'] as const),
    ...(input.rpe == null ? [] : ['rpe'] as const),
  ]
  return normalizeRealizedTrainingRecord({
    id: input.id,
    teamId: 'team-1',
    athleteId: 'athlete-1',
    sessionId: `session-${input.id}`,
    workoutId: null,
    date: input.date,
    status: 'completed',
    distanceKm: input.distanceKm,
    durationMin: input.durationMin,
    elevationGainM: input.elevationGainM ?? null,
    avgHrBpm: input.avgHrBpm ?? null,
    rpe: input.rpe ?? null,
    loggedAt: `${input.date}T18:00:00.000Z`,
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields,
  })
}

describe('recent preparation summary', () => {
  it('resume volumen, duración, D+, frecuencia, intensidad, larga y continuidad con unidades', () => {
    const summary = buildRecentPreparationSummary({
      records: [
        realized({ id: 'a', date: '2026-09-02', distanceKm: 8, durationMin: 50, elevationGainM: 200, rpe: 4 }),
        realized({ id: 'b', date: '2026-09-09', distanceKm: 10, durationMin: 60, elevationGainM: 300, rpe: 5 }),
        realized({ id: 'c', date: '2026-09-16', distanceKm: 12, durationMin: 75, elevationGainM: 450, rpe: 6 }),
        realized({ id: 'd', date: '2026-09-23', distanceKm: 20, durationMin: 130, elevationGainM: 800, rpe: 7 }),
      ],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(summary.dataStatus, 'sufficient')
    assert.deepEqual(summary.volume.totalKm, {
      state: 'known', value: 50, unit: 'km', sampleSize: 4, coverageRatio: 1,
    })
    assert.deepEqual(summary.volume.averageWeeklyKm, {
      state: 'known', value: 12.5, unit: 'km_per_week', sampleSize: 4, coverageRatio: 1,
    })
    assert.equal(summary.longRun.longestDistanceKm.state, 'known')
    if (summary.longRun.longestDistanceKm.state === 'known') {
      assert.equal(summary.longRun.longestDistanceKm.value, 20)
    }
    assert.equal(summary.frequency.recordedSessionsPerWeek.state, 'known')
    assert.equal(summary.continuity.activeBuckets, 4)
    assert.equal(summary.intensity.averageRpe.state, 'known')
  })

  it('mantiene D+ e intensidad unknown cuando su cobertura es insuficiente sin borrar volumen fiable', () => {
    const summary = buildRecentPreparationSummary({
      records: [
        realized({ id: 'a', date: '2026-09-02', distanceKm: 8, durationMin: 50, elevationGainM: null }),
        realized({ id: 'b', date: '2026-09-09', distanceKm: 10, durationMin: 60, elevationGainM: null }),
        realized({ id: 'c', date: '2026-09-16', distanceKm: 12, durationMin: 75, elevationGainM: 450 }),
        realized({ id: 'd', date: '2026-09-23', distanceKm: 20, durationMin: 130, elevationGainM: 800 }),
      ],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(summary.volume.totalKm.state, 'known')
    assert.equal(summary.elevation.totalGainM.state, 'unknown')
    assert.equal(summary.intensity.averageRpe.state, 'unknown')
    assert.ok(summary.limitations.includes('insufficient_elevationGainM_coverage'))
  })

  it('no produce métricas aparentemente positivas cuando el conjunto global es insuficiente', () => {
    const summary = buildRecentPreparationSummary({
      records: [realized({ id: 'a', date: '2026-09-23', distanceKm: 20, durationMin: 130, elevationGainM: 800 })],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(summary.dataStatus, 'insufficient_data')
    assert.equal(summary.volume.totalKm.state, 'unknown')
    assert.equal(summary.longRun.longestDistanceKm.state, 'unknown')
    assert.ok(summary.limitations.includes('insufficient_overall_data'))
  })
})
