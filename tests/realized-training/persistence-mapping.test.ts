import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  mapManualCaptureToPersistenceRows,
  mapPersistenceToRawRealizedTrainingRecord,
} from '@/lib/realized-training/persistence-mapping'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

const unknown = { state: 'unknown' } as const

function capture(
  overrides: Partial<ManualRealizedTrainingCaptureInput> = {},
): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'athlete-1',
    sessionId: null,
    workoutId: null,
    date: '2026-09-13',
    status: 'completed',
    metrics: {
      distanceKm: unknown,
      durationMin: unknown,
      elevationGainM: unknown,
      avgHrBpm: unknown,
      rpe: unknown,
    },
    feeling: null,
    athleteNotes: null,
    ...overrides,
  }
}

const context = {
  workoutLogId: 'log-1',
  evidenceId: 'evidence-1',
  loggedAt: '2026-09-13T20:00:00.000Z',
} as const

describe('realized training persistence mapping', () => {
  it('stores unknown numeric metrics with legacy-compatible fallbacks but no known evidence', () => {
    const rows = mapManualCaptureToPersistenceRows(capture(), context)

    assert.equal(rows.workoutLog.distanceKm, 0)
    assert.equal(rows.workoutLog.durationMin, 0)
    assert.equal(rows.workoutLog.elevationGain, 0)
    assert.equal(rows.workoutLog.avgHr, null)
    assert.equal(rows.workoutLog.rpe, 0)
    assert.deepEqual(rows.evidence.knownMetricFields, [])
    assert.equal(rows.evidence.source, 'manual')
    assert.equal(rows.evidence.sourceActivityId, null)
  })

  it('marks explicit zero as known evidence instead of treating it as missing', () => {
    const rows = mapManualCaptureToPersistenceRows(
      capture({
        metrics: {
          distanceKm: { state: 'known', value: 0 },
          durationMin: { state: 'known', value: 60 },
          elevationGainM: { state: 'known', value: 0 },
          avgHrBpm: unknown,
          rpe: { state: 'known', value: 0 },
        },
      }),
      context,
    )

    assert.deepEqual(rows.evidence.knownMetricFields, [
      'distanceKm',
      'durationMin',
      'elevationGainM',
      'rpe',
    ])
  })

  it('round-trips unknown and known zero through the H12 normalization boundary', () => {
    const rows = mapManualCaptureToPersistenceRows(
      capture({
        metrics: {
          distanceKm: { state: 'known', value: 0 },
          durationMin: { state: 'known', value: 75 },
          elevationGainM: unknown,
          avgHrBpm: { state: 'known', value: 148 },
          rpe: unknown,
        },
      }),
      context,
    )

    const raw = mapPersistenceToRawRealizedTrainingRecord({
      teamId: 'team-1',
      log: {
        id: rows.workoutLog.id,
        athleteId: rows.workoutLog.athleteId,
        sessionId: rows.workoutLog.sessionId,
        workoutId: rows.workoutLog.workoutId,
        date: rows.workoutLog.date,
        status: rows.workoutLog.status,
        distanceKm: rows.workoutLog.distanceKm,
        durationMin: rows.workoutLog.durationMin,
        elevationGain: rows.workoutLog.elevationGain,
        avgHr: rows.workoutLog.avgHr,
        rpe: rows.workoutLog.rpe,
        loggedAt: rows.workoutLog.loggedAt,
      },
      evidence: rows.evidence,
    })

    const normalized = normalizeRealizedTrainingRecord(raw)

    assert.deepEqual(normalized.metrics.distanceKm, { state: 'known', value: 0 })
    assert.deepEqual(normalized.metrics.durationMin, { state: 'known', value: 75 })
    assert.deepEqual(normalized.metrics.elevationGainM, { state: 'unknown', reason: 'legacy_zero_ambiguous' })
    assert.deepEqual(normalized.metrics.avgHrBpm, { state: 'known', value: 148 })
    assert.deepEqual(normalized.metrics.rpe, { state: 'unknown', reason: 'legacy_zero_ambiguous' })
  })

  it('keeps rows without evidence explicitly legacy-ambiguous', () => {
    const raw = mapPersistenceToRawRealizedTrainingRecord({
      teamId: 'team-1',
      log: {
        id: 'legacy-log',
        athleteId: 'athlete-1',
        sessionId: null,
        workoutId: null,
        date: '2026-09-12',
        status: 'completed',
        distanceKm: 0,
        durationMin: 0,
        elevationGain: 0,
        avgHr: null,
        rpe: 0,
        loggedAt: '2026-09-12T20:00:00.000Z',
      },
      evidence: null,
    })

    const normalized = normalizeRealizedTrainingRecord(raw)

    assert.ok(normalized.limitations.includes('legacy_record_without_metric_evidence'))
    assert.equal(normalized.metrics.distanceKm.state, 'unknown')
  })
})
