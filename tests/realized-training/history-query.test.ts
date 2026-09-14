import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import Database from 'better-sqlite3'

import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

it('lists only durable realized evidence for the requested athlete, newest first', async () => {
  const originalDirectory = process.cwd()
  const directory = mkdtempSync(join(tmpdir(), 'kan291-'))
  const sqlite = new Database(join(directory, 'sqlite.db'))
  let closeRepository: (() => void) | undefined

  try {
    sqlite.exec(readFileSync('drizzle/sqlite/0000_baseline.sql', 'utf8'))
    migrateRealizedTrainingTimingSqlite(sqlite)
    sqlite.exec(`
      INSERT INTO teams (id,created_at,updated_at,name) VALUES ('t','now','now','Team');
      INSERT INTO users (id,created_at,updated_at,user_name,email,first_name,last_name) VALUES
        ('u1','now','now','one','one@example.test','One','Athlete'),
        ('u2','now','now','two','two@example.test','Two','Athlete');
      INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni) VALUES
        ('a1','now','now','u1','t','one'),
        ('a2','now','now','u2','t','two');
    `)

    process.chdir(directory)
    const {
      createManualRealizedTrainingRecord,
      listRealizedTrainingRecordsForAthlete,
    } = await import('@/lib/realized-training/realized-training-repository')
    const { db } = await import('@/db')
    closeRepository = () => db.$client.close()
    process.chdir(originalDirectory)

    const unknown = { state: 'unknown' } as const
    const capture = (
      athleteId: string,
      date: string,
      distanceKm: ManualRealizedTrainingCaptureInput['metrics']['distanceKm'],
    ): ManualRealizedTrainingCaptureInput => ({
      athleteId,
      sessionId: null,
      workoutId: null,
      date,
      performedAt: `${date}T08:00:00-03:00`,
      status: 'completed',
      metrics: {
        distanceKm,
        durationMin: unknown,
        elevationGainM: unknown,
        avgHrBpm: unknown,
        rpe: unknown,
      },
      feeling: null,
      athleteNotes: null,
    })

    const older = createManualRealizedTrainingRecord(capture('a1', '2026-09-10', { state: 'known', value: 0 }))
    const newer = createManualRealizedTrainingRecord(capture('a1', '2026-09-12', unknown))
    createManualRealizedTrainingRecord(capture('a2', '2026-09-13', { state: 'known', value: 20 }))

    const history = listRealizedTrainingRecordsForAthlete('a1')
    assert.deepEqual(history.map((record) => record.id), [newer.id, older.id])
    assert.deepEqual(history[0]?.metrics.distanceKm, { state: 'unknown', reason: 'not_recorded' })
    assert.deepEqual(history[1]?.metrics.distanceKm, { state: 'known', value: 0 })
    assert.equal(history.every((record) => record.athleteId === 'a1'), true)

    sqlite.prepare('UPDATE workout_logs SET is_deleted = 1 WHERE id = ?').run(newer.id)
    assert.deepEqual(
      listRealizedTrainingRecordsForAthlete('a1').map((record) => record.id),
      [older.id],
    )
  } finally {
    process.chdir(originalDirectory)
    closeRepository?.()
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
