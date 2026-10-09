import assert from 'node:assert/strict'
import test from 'node:test'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import {
  createManualRealizedTrainingRecord,
  listRealizedTrainingRecordsForAthleteInDateRange,
} from '@/lib/realized-training/realized-training-repository'

const schema = [
  'CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE workout_logs (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, athlete_id TEXT NOT NULL, session_id TEXT, workout_id TEXT, date TEXT NOT NULL, status TEXT NOT NULL, distance_km REAL NOT NULL DEFAULT 0, duration_min REAL NOT NULL DEFAULT 0, elevation_gain INTEGER NOT NULL DEFAULT 0, avg_hr INTEGER, feeling TEXT, rpe INTEGER, athlete_notes TEXT, performed_at TEXT, logged_at TEXT NOT NULL)',
  'CREATE TABLE workout_log_evidence (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, workout_log_id TEXT NOT NULL, source TEXT NOT NULL, source_activity_id TEXT, known_metric_fields TEXT NOT NULL)',
]

const capture = (athleteId: string, athleteNotes: string) => ({
  athleteId, sessionId: null, workoutId: null, date: '2026-10-09',
  performedAt: '2026-10-09T08:00:00-03:00', status: 'completed' as const,
  metrics: {
    distanceKm: { state: 'known' as const, value: 8 },
    durationMin: { state: 'known' as const, value: 52 },
    elevationGainM: { state: 'unknown' as const },
    avgHrBpm: { state: 'unknown' as const },
    rpe: { state: 'unknown' as const },
  },
  feeling: null, athleteNotes,
})

test('KAN-703 same-Team SELF range read exposes only own WorkoutLogs and preserves stored evidence', () => {
  for (const statement of schema) db.run(sql.raw(statement))
  db.run(sql.raw("INSERT INTO athlete_profiles VALUES ('self-a','team_1',0),('self-b','team_1',0)"))

  const recordA = createManualRealizedTrainingRecord(capture('self-a', 'A private notes'))
  const recordB = createManualRealizedTrainingRecord(capture('self-b', 'B private notes'))

  const read = (id: string, teamId: string) =>
    listRealizedTrainingRecordsForAthleteInDateRange(id, teamId, '2026-10-05', '2026-10-11')

  const ownA = read('self-a', 'team_1')
  const ownB = read('self-b', 'team_1')
  assert.deepEqual(ownA.map(record => record.id), [recordA.id])
  assert.deepEqual(ownB.map(record => record.id), [recordB.id])
  assert.ok(ownA.every(record => record.athleteId === 'self-a'))
  assert.ok(ownB.every(record => record.athleteId === 'self-b'))
  assert.deepEqual(read('self-a', 'different-team'), [])
  assert.deepEqual(read('self-b', 'different-team'), [])

  const rows = db.get<{ count: number }>(sql.raw('SELECT COUNT(*) AS count FROM workout_logs'))
  const evidence = db.get<{ count: number }>(sql.raw('SELECT COUNT(*) AS count FROM workout_log_evidence'))
  assert.equal(rows?.count, 2)
  assert.equal(evidence?.count, 2)
})
