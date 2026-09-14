import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import Database from 'better-sqlite3'

import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

const unknown = { state: 'unknown' } as const

function capture(athleteId: string): ManualRealizedTrainingCaptureInput {
  return {
    athleteId,
    sessionId: null,
    workoutId: null,
    date: '2026-09-14',
    performedAt: '2026-09-14T08:00:00-03:00',
    status: 'completed',
    metrics: {
      distanceKm: { state: 'known', value: 12 },
      durationMin: { state: 'known', value: 75 },
      elevationGainM: unknown,
      avgHrBpm: unknown,
      rpe: unknown,
    },
    feeling: null,
    athleteNotes: null,
  }
}

it('rejects correction when the workout log belongs to another athlete', async () => {
  const originalDirectory = process.cwd()
  const directory = mkdtempSync(join(tmpdir(), 'kan294-correction-'))
  const sqlite = new Database(join(directory, 'sqlite.db'))
  let closeRepository: (() => void) | undefined

  try {
    sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
    migrateRealizedTrainingTimingSqlite(sqlite)
    sqlite.exec(`
      INSERT INTO teams (id,created_at,updated_at,name) VALUES
        ('t1','now','now','Team One'),
        ('t2','now','now','Team Two');
      INSERT INTO users (id,created_at,updated_at,user_name,email,first_name,last_name) VALUES
        ('u1','now','now','one','one@example.test','One','Athlete'),
        ('u2','now','now','two','two@example.test','Two','Athlete');
      INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni) VALUES
        ('a1','now','now','u1','t1','one'),
        ('a2','now','now','u2','t2','two');
    `)

    process.chdir(directory)
    const { createManualRealizedTrainingRecord } = await import(
      '@/lib/realized-training/realized-training-repository'
    )
    const { correctManualRealizedTrainingRecord } = await import(
      '@/lib/realized-training/realized-training-correction-repository'
    )
    const { db } = await import('@/db')
    closeRepository = () => db.$client.close()
    process.chdir(originalDirectory)

    const ownedByFirstAthlete = createManualRealizedTrainingRecord(capture('a1'))

    assert.throws(
      () => correctManualRealizedTrainingRecord({
        workoutLogId: ownedByFirstAthlete.id,
        athleteId: 'a2',
        correctedByUserId: 'u2',
        reason: 'Attempted foreign correction',
        replacement: {
          ...capture('a2'),
          metrics: {
            ...capture('a2').metrics,
            distanceKm: { state: 'known', value: 20 },
          },
        },
      }),
      (error) => error instanceof Error && error.message === 'realized_training_record_not_found',
    )

    const persistedDistance = sqlite
      .prepare('SELECT distance_km AS distanceKm FROM workout_logs WHERE id = ?')
      .get(ownedByFirstAthlete.id) as { distanceKm: number }
    assert.equal(persistedDistance.distanceKm, 12)
  } finally {
    process.chdir(originalDirectory)
    closeRepository?.()
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
