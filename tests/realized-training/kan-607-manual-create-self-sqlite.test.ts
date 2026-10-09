import assert from 'node:assert/strict'
import test from 'node:test'
import { sql } from 'drizzle-orm'

import { db } from '@/db'
import { createManualRealizedTrainingRecord } from '@/lib/realized-training/realized-training-repository'

const schema = [
  `CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY,team_id TEXT NOT NULL,is_deleted INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE workout_logs (
    id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    athlete_id TEXT NOT NULL,session_id TEXT,workout_id TEXT,date TEXT NOT NULL,
    status TEXT NOT NULL,distance_km REAL NOT NULL DEFAULT 0,duration_min REAL NOT NULL DEFAULT 0,
    elevation_gain INTEGER NOT NULL DEFAULT 0,avg_hr INTEGER,feeling TEXT,rpe INTEGER,
    athlete_notes TEXT,performed_at TEXT,logged_at TEXT NOT NULL
  )`,
  `CREATE TABLE workout_log_evidence (
    id TEXT PRIMARY KEY,is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    workout_log_id TEXT NOT NULL,source TEXT NOT NULL,source_activity_id TEXT,
    known_metric_fields TEXT NOT NULL
  )`,
]

const input = {
  athleteId: 'athlete-self', sessionId: null, workoutId: null,
  date: '2026-10-09', performedAt: '2026-10-09T08:00:00-03:00',
  status: 'completed' as const,
  metrics: {
    distanceKm: { state: 'known' as const, value: 8 },
    durationMin: { state: 'known' as const, value: 53 },
    elevationGainM: { state: 'unknown' as const },
    avgHrBpm: { state: 'unknown' as const },
    rpe: { state: 'known' as const, value: 5 },
  },
  feeling: null, athleteNotes: 'Free trail run',
}

test('KAN-701 real SQLite repository commits free SELF WorkoutLog plus evidence atomically and rolls both back if sidecar rejects', () => {
  for (const statement of schema) db.run(sql.raw(statement))
  db.run(sql.raw("INSERT INTO athlete_profiles(id,team_id,is_deleted) VALUES ('athlete-self','team-self',0)"))

  const persisted = createManualRealizedTrainingRecord(input)
  assert.equal(persisted.athleteId, input.athleteId)
  assert.equal(persisted.sessionId, null)
  assert.equal(persisted.workoutId, null)
  assert.equal(persisted.provenance.source, 'manual')
  const evidence = db.get<{ source: string; workout_log_id: string }>(sql.raw(
    'SELECT source, workout_log_id FROM workout_log_evidence',
  ))
  assert.equal(evidence?.source, 'manual')
  assert.equal(evidence?.workout_log_id, persisted.id)

  const counts = () => ({
    logs: (db.get<{ count: number }>(sql.raw('SELECT COUNT(*) AS count FROM workout_logs')))?.count,
    evidence: (db.get<{ count: number }>(sql.raw('SELECT COUNT(*) AS count FROM workout_log_evidence')))?.count,
  })
  assert.deepEqual(counts(), { logs: 1, evidence: 1 })

  db.run(sql.raw(`CREATE TRIGGER reject_next_sidecar BEFORE INSERT ON workout_log_evidence
    BEGIN SELECT RAISE(ABORT, 'forced sidecar failure'); END`))
  assert.throws(() => createManualRealizedTrainingRecord(input), /forced sidecar failure/)
  assert.deepEqual(counts(), { logs: 1, evidence: 1 })
})
