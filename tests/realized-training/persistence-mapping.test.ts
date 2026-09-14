import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  mapManualCaptureToPersistenceRows,
  mapPersistenceToManualRealizedTrainingClientInput,
  mapPersistenceToRawRealizedTrainingRecord,
} from '@/lib/realized-training/persistence-mapping'
import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

const context = {
  workoutLogId: 'log-1',
  evidenceId: 'evidence-1',
  loggedAt: '2026-09-14T12:00:00.000Z',
} as const

const unknown = { state: 'unknown' } as const

function capture(
  overrides: Partial<ManualRealizedTrainingCaptureInput> = {},
): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'athlete-1',
    sessionId: null,
    workoutId: null,
    date: '2026-09-14',
    performedAt: '2026-09-14T08:00:00-03:00',
    status: 'completed',
    metrics: {
      distanceKm: { state: 'known', value: 12 },
      durationMin: { state: 'known', value: 75 },
      elevationGainM: { state: 'known', value: 500 },
      avgHrBpm: unknown,
      rpe: { state: 'known', value: 6 },
    },
    feeling: null,
    athleteNotes: null,
    ...overrides,
  }
}

describe('realized training persistence mapping', () => {
  it('maps known and unknown metrics to durable rows without losing evidence semantics', () => {
    const rows = mapManualCaptureToPersistenceRows(
      capture({
        metrics: {
          distanceKm: { state: 'known', value: 12 },
          durationMin: { state: 'known', value: 75 },
          elevationGainM: { state: 'known', value: 500 },
          avgHrBpm: unknown,
          rpe: { state: 'known', value: 6 },
        },
      }),
      context,
    )

    assert.equal(rows.workoutLog.distanceKm, 12)
    assert.equal(rows.workoutLog.durationMin, 75)
    assert.equal(rows.workoutLog.elevationGain, 500)
    assert.equal(rows.workoutLog.avgHr, null)
    assert.equal(rows.workoutLog.rpe, 6)
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
    assert.deepEqual(normalized.metrics.elevationGainM, { state: 'unknown', reason: 'not_recorded' })
    assert.deepEqual(normalized.metrics.avgHrBpm, { state: 'known', value: 148 })
    assert.deepEqual(normalized.metrics.rpe, { state: 'unknown', reason: 'not_recorded' })
  })

  it('reconstructs editable manual evidence without turning unknown fallbacks into zero', () => {
    const rows = mapManualCaptureToPersistenceRows(
      capture({
        sessionId: 'session-1',
        metrics: {
          distanceKm: { state: 'known', value: 0 },
          durationMin: { state: 'known', value: 61.5 },
          elevationGainM: unknown,
          avgHrBpm: { state: 'known', value: 145 },
          rpe: unknown,
        },
        feeling: 'normal',
        athleteNotes: 'Recorded notes',
      }),
      context,
    )

    const editable = mapPersistenceToManualRealizedTrainingClientInput({
      log: {
        id: rows.workoutLog.id,
        athleteId: rows.workoutLog.athleteId,
        sessionId: rows.workoutLog.sessionId,
        workoutId: rows.workoutLog.workoutId,
        date: rows.workoutLog.date,
        performedAt: rows.workoutLog.performedAt,
        status: rows.workoutLog.status,
        distanceKm: rows.workoutLog.distanceKm,
        durationMin: rows.workoutLog.durationMin,
        elevationGain: rows.workoutLog.elevationGain,
        avgHr: rows.workoutLog.avgHr,
        feeling: rows.workoutLog.feeling,
        rpe: rows.workoutLog.rpe,
        athleteNotes: rows.workoutLog.athleteNotes,
        loggedAt: rows.workoutLog.loggedAt,
      },
      evidence: rows.evidence,
    })

    assert.ok(editable)
    assert.deepEqual(editable.metrics.distanceKm, { state: 'known', value: 0 })
    assert.deepEqual(editable.metrics.durationMin, { state: 'known', value: 61.5 })
    assert.deepEqual(editable.metrics.elevationGainM, { state: 'unknown' })
    assert.deepEqual(editable.metrics.avgHrBpm, { state: 'known', value: 145 })
    assert.deepEqual(editable.metrics.rpe, { state: 'unknown' })
    assert.equal(editable.feeling, 'normal')
    assert.equal(editable.athleteNotes, 'Recorded notes')
  })

  it('does not reconstruct editable input for legacy or imported evidence', () => {
    const rows = mapManualCaptureToPersistenceRows(capture(), context)
    const log = {
      id: rows.workoutLog.id,
      athleteId: rows.workoutLog.athleteId,
      sessionId: rows.workoutLog.sessionId,
      workoutId: rows.workoutLog.workoutId,
      date: rows.workoutLog.date,
      performedAt: rows.workoutLog.performedAt,
      status: rows.workoutLog.status,
      distanceKm: rows.workoutLog.distanceKm,
      durationMin: rows.workoutLog.durationMin,
      elevationGain: rows.workoutLog.elevationGain,
      avgHr: rows.workoutLog.avgHr,
      feeling: rows.workoutLog.feeling,
      rpe: rows.workoutLog.rpe,
      athleteNotes: rows.workoutLog.athleteNotes,
      loggedAt: rows.workoutLog.loggedAt,
    }

    assert.equal(mapPersistenceToManualRealizedTrainingClientInput({ log, evidence: null }), null)
    assert.equal(
      mapPersistenceToManualRealizedTrainingClientInput({
        log,
        evidence: {
          source: 'imported',
          sourceActivityId: 'provider:activity-1',
          knownMetricFields: rows.evidence.knownMetricFields,
        },
      }),
      null,
    )
  })
})
