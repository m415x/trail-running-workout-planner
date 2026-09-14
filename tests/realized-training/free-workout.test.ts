import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { normalizeRealizedTrainingRecord } from '@/lib/readiness/realized-training'
import {
  mapManualCaptureToPersistenceRows,
  mapPersistenceToRawRealizedTrainingRecord,
} from '@/lib/realized-training/persistence-mapping'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

function freeCapture(): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'athlete-1',
    sessionId: null,
    workoutId: null,
    date: '2026-09-13',
    performedAt: '2026-09-13T08:30:00-03:00',
    status: 'completed',
    metrics: {
      distanceKm: { state: 'known', value: 12.4 },
      durationMin: { state: 'known', value: 80 },
      elevationGainM: { state: 'known', value: 620 },
      avgHrBpm: { state: 'known', value: 146 },
      rpe: { state: 'known', value: 6 },
    },
    feeling: 'good',
    athleteNotes: 'Entrenamiento libre en sendero.',
  }
}

describe('free realized training', () => {
  it('remains usable evidence without a planned Session', () => {
    const rows = mapManualCaptureToPersistenceRows(freeCapture(), {
      workoutLogId: 'free-log-1',
      evidenceId: 'free-evidence-1',
      loggedAt: '2026-09-13T21:00:00.000Z',
    })

    const normalized = normalizeRealizedTrainingRecord(
      mapPersistenceToRawRealizedTrainingRecord({
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
      }),
    )

    assert.equal(normalized.sessionId, null)
    assert.equal(normalized.provenance.sessionLink, 'none')
    assert.equal(normalized.quality, 'usable')
    assert.ok(normalized.limitations.includes('no_authoritative_session_link'))
    assert.deepEqual(normalized.metrics.distanceKm, { state: 'known', value: 12.4 })
  })
})
