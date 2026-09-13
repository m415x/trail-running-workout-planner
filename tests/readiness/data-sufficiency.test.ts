import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  buildReadinessAnalysisWindow,
  evaluateReadinessDataSufficiency,
  isMetricCoverageSufficient,
} from '@/lib/readiness/data-sufficiency'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import type {
  RawRealizedTrainingRecord,
  ReadinessDataSufficiencyPolicy,
} from '@/types'

const policy: ReadinessDataSufficiencyPolicy = {
  lookbackDays: 28,
  bucketDays: 7,
  minimumPerformedSessions: 4,
  minimumActiveBuckets: 3,
  minimumMetricCoverageRatio: 0.75,
}

function record(input: {
  id: string
  date: string
  distanceKnown?: boolean
  elevationKnown?: boolean
  teamId?: string
  athleteId?: string
}) {
  const known = ['durationMin', 'rpe'] as Array<'durationMin' | 'rpe' | 'distanceKm' | 'elevationGainM'>
  if (input.distanceKnown ?? true) known.push('distanceKm')
  if (input.elevationKnown ?? true) known.push('elevationGainM')

  const raw: RawRealizedTrainingRecord = {
    id: input.id,
    teamId: input.teamId ?? 'team-1',
    athleteId: input.athleteId ?? 'athlete-1',
    sessionId: `session-${input.id}`,
    workoutId: null,
    date: input.date,
    status: 'completed',
    distanceKm: input.distanceKnown === false ? null : 10,
    durationMin: 60,
    elevationGainM: input.elevationKnown === false ? null : 300,
    avgHrBpm: null,
    rpe: 5,
    loggedAt: `${input.date}T18:00:00.000Z`,
    source: 'manual',
    sourceActivityId: null,
    knownMetricFields: known,
  }
  return normalizeRealizedTrainingRecord(raw)
}

describe('readiness data sufficiency', () => {
  it('construye una ventana inclusiva de 28 días', () => {
    assert.deepEqual(
      buildReadinessAnalysisWindow({ endDate: '2026-09-28', policy }),
      {
        startDate: '2026-09-01',
        endDate: '2026-09-28',
        windowDays: 28,
        bucketDays: 7,
      },
    )
  })

  it('exige cantidad y continuidad mínima sin contar otro atleta o equipo', () => {
    const result = evaluateReadinessDataSufficiency({
      records: [
        record({ id: 'a', date: '2026-09-02' }),
        record({ id: 'b', date: '2026-09-09' }),
        record({ id: 'c', date: '2026-09-16' }),
        record({ id: 'd', date: '2026-09-20' }),
        record({ id: 'other-athlete', date: '2026-09-24', athleteId: 'athlete-2' }),
        record({ id: 'other-team', date: '2026-09-25', teamId: 'team-2' }),
      ],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(result.status, 'sufficient')
    assert.equal(result.coverage.performedRecords, 4)
    assert.equal(result.coverage.activeBuckets, 3)
  })

  it('devuelve insufficient_data en vez de confirmar preparación con pocos registros', () => {
    const result = evaluateReadinessDataSufficiency({
      records: [record({ id: 'a', date: '2026-09-20' })],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(result.status, 'insufficient_data')
    if (result.status !== 'insufficient_data') return
    assert.ok(result.reasons.includes('too_few_performed_sessions'))
    assert.ok(result.reasons.includes('too_few_active_buckets'))
  })

  it('mantiene suficiencia por dimensión: volumen puede ser usable aunque D+ no lo sea', () => {
    const result = evaluateReadinessDataSufficiency({
      records: [
        record({ id: 'a', date: '2026-09-02', elevationKnown: false }),
        record({ id: 'b', date: '2026-09-09', elevationKnown: false }),
        record({ id: 'c', date: '2026-09-16' }),
        record({ id: 'd', date: '2026-09-23' }),
      ],
      teamId: 'team-1',
      athleteId: 'athlete-1',
      endDate: '2026-09-28',
      policy,
    })

    assert.equal(result.status, 'sufficient')
    assert.equal(isMetricCoverageSufficient(result.coverage, 'distanceKm'), true)
    assert.equal(isMetricCoverageSufficient(result.coverage, 'elevationGainM'), false)
    assert.equal(result.coverage.metrics.elevationGainM.ratio, 0.5)
  })
})
