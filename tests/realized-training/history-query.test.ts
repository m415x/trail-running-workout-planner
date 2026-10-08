import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import Database from 'better-sqlite3'

import { migrateRealizedTrainingTimingSqlite } from '@/db/migrations/realized-training-timing-sqlite'
import type { ManualRealizedTrainingCaptureInput } from '@/types/training/realized-training-capture.types'

it('lists realized evidence only when athlete and team scopes both match', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kan294-'))
  const databasePath = join(directory, 'sqlite.db')
  const sqlite = new Database(databasePath)
  const previousScenarioMode = process.env.SQLITE_SCENARIO_MODE
  const previousDatabasePath = process.env.SQLITE_DATABASE_PATH
  process.env.SQLITE_SCENARIO_MODE = '1'
  process.env.SQLITE_DATABASE_PATH = databasePath
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
        ('u2','now','now','two','two@example.test','Two','Athlete'),
        ('u3','now','now','three','three@example.test','Three','Athlete');
      INSERT INTO athlete_profiles (id,created_at,updated_at,user_id,team_id,dni) VALUES
        ('a1','now','now','u1','t1','one'),
        ('a2','now','now','u2','t1','two'),
        ('a3','now','now','u3','t2','three');
    `)

    const {
      createManualRealizedTrainingRecord,
      listRealizedTrainingRecordsForAthlete,
      listRealizedTrainingRecordsForAthleteInDateRange,
    } = await import('@/lib/realized-training/realized-training-repository')
    const { db } = await import('@/db')
    closeRepository = () => db.$client.close()

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
    createManualRealizedTrainingRecord(capture('a3', '2026-09-14', { state: 'known', value: 30 }))

    const history = listRealizedTrainingRecordsForAthlete('a1', 't1')
    assert.deepEqual(history.map((record) => record.id), [newer.id, older.id])
    assert.deepEqual(history[0]?.metrics.distanceKm, { state: 'unknown', reason: 'not_recorded' })
    assert.deepEqual(history[1]?.metrics.distanceKm, { state: 'known', value: 0 })
    assert.equal(history.every((record) => record.athleteId === 'a1' && record.teamId === 't1'), true)

    const calendarRange = listRealizedTrainingRecordsForAthleteInDateRange(
      'a1',
      't1',
      '2026-09-11',
      '2026-09-13',
    )
    assert.deepEqual(calendarRange.map(record => record.id), [newer.id])
    assert.equal(calendarRange.every(record => record.athleteId === 'a1' && record.teamId === 't1'), true)
    assert.deepEqual(
      listRealizedTrainingRecordsForAthleteInDateRange('a1', 't2', '2026-09-01', '2026-09-30'),
      [],
    )

    assert.deepEqual(listRealizedTrainingRecordsForAthlete('a1', 't2'), [])
    assert.deepEqual(listRealizedTrainingRecordsForAthlete('a3', 't1'), [])

    sqlite.prepare('UPDATE workout_logs SET is_deleted = 1 WHERE id = ?').run(newer.id)
    assert.deepEqual(
      listRealizedTrainingRecordsForAthlete('a1', 't1').map((record) => record.id),
      [older.id],
    )
  } finally {
    if (previousScenarioMode === undefined) delete process.env.SQLITE_SCENARIO_MODE
    else process.env.SQLITE_SCENARIO_MODE = previousScenarioMode
    if (previousDatabasePath === undefined) delete process.env.SQLITE_DATABASE_PATH
    else process.env.SQLITE_DATABASE_PATH = previousDatabasePath
    closeRepository?.()
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
