import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import Database from 'better-sqlite3'

import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'
import type { ReadinessDataSufficiencyPolicy } from '@/types/training/readiness.types'

const policy: ReadinessDataSufficiencyPolicy = {
  lookbackDays: 14,
  bucketDays: 7,
  minimumPerformedSessions: 1,
  minimumActiveBuckets: 1,
  minimumMetricCoverageRatio: 1,
}

const unknown = { state: 'unknown' } as const

function capture(): ManualRealizedTrainingCaptureInput {
  return {
    athleteId: 'a1',
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
      rpe: unknown,
    },
    feeling: null,
    athleteNotes: null,
  }
}

it('uses durable realized evidence and preserves legacy ambiguity', async () => {
  const originalDirectory = process.cwd()
  const directory = mkdtempSync(join(tmpdir(), 'kan295-durable-'))
  const sqlite = new Database(join(directory, 'sqlite.db'))
  let closeRepository: (() => void) | undefined

  try {
    sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
    migrateRealizedTrainingTimingSqlite(sqlite)
    sqlite.exec(`
      INSERT INTO teams (id,created_at,updated_at,name) VALUES ('t1','now','now','Team One');
      INSERT INTO users (id,created_at,updated_at,user_name,email,first_name,last_name) VALUES
        ('u1','now','now','one','one@example.test','One','Athlete'),
        ('u2','now','now','two','two@example.test','Two','Athlete');
      INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni) VALUES
        ('a1','now','now','u1','t1','one'),
        ('a2','now','now','u2','t1','two');
      INSERT INTO workout_logs (
        id,is_deleted,created_at,updated_at,athlete_id,date,status,
        distance_km,duration_min,elevation_gain,rpe,logged_at
      ) VALUES (
        'legacy-log',0,'now','now','a2','2026-09-14','completed',0,0,0,0,'2026-09-14T12:00:00.000Z'
      );
    `)

    process.chdir(directory)
    const { createManualRealizedTrainingRecord } = await import(
      '@/lib/realized-training/realized-training-repository'
    )
    const { buildDurableRecentPreparation } = await import(
      '@/lib/readiness/durable-realized-training'
    )
    const { db } = await import('@/db')
    closeRepository = () => db.$client.close()
    process.chdir(originalDirectory)

    createManualRealizedTrainingRecord(capture())

    const durable = buildDurableRecentPreparation({
      teamId: 't1',
      athleteId: 'a1',
      endDate: '2026-09-14',
      policy,
    })

    assert.equal(durable.summary.performedRecords, 1)
    assert.deepEqual(durable.summary.volume.totalKm, {
      state: 'known',
      value: 12,
      unit: 'km',
      sampleSize: 1,
      coverageRatio: 1,
    })
    assert.deepEqual(durable.duplicateRecordIds, [])

    const legacy = buildDurableRecentPreparation({
      teamId: 't1',
      athleteId: 'a2',
      endDate: '2026-09-14',
      policy,
    })

    assert.equal(legacy.summary.dataStatus, 'sufficient')
    assert.equal(legacy.summary.volume.totalKm.state, 'unknown')
    assert.ok(legacy.summary.limitations.includes('legacy_record_without_metric_evidence'))
    assert.ok(legacy.summary.limitations.includes('insufficient_distanceKm_coverage'))
  } finally {
    process.chdir(originalDirectory)
    closeRepository?.()
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
