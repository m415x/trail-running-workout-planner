import assert from 'node:assert/strict'
import test from 'node:test'
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workoutLogs } from '@/db/schema'
import { createManualRealizedTrainingRecord } from '@/lib/realized-training/realized-training-repository'
import { correctManualRealizedTrainingRecord, listRealizedTrainingCorrections } from '@/lib/realized-training/realized-training-correction-repository'

const setup = [
  'CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0)',
  'CREATE TABLE workout_logs (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, athlete_id TEXT NOT NULL, session_id TEXT, workout_id TEXT, date TEXT NOT NULL, status TEXT NOT NULL, distance_km REAL NOT NULL DEFAULT 0, duration_min REAL NOT NULL DEFAULT 0, elevation_gain INTEGER NOT NULL DEFAULT 0, avg_hr INTEGER, feeling TEXT, rpe INTEGER, athlete_notes TEXT, performed_at TEXT, logged_at TEXT NOT NULL)',
  'CREATE TABLE workout_log_evidence (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, workout_log_id TEXT NOT NULL, source TEXT NOT NULL, source_activity_id TEXT, known_metric_fields TEXT NOT NULL)',
  'CREATE TABLE workout_log_corrections (id TEXT PRIMARY KEY, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, workout_log_id TEXT NOT NULL, corrected_by_user_id TEXT NOT NULL, corrected_at TEXT NOT NULL, reason TEXT, before_snapshot TEXT NOT NULL, after_snapshot TEXT NOT NULL)',
]
const initial = {
  athleteId: 'self-a', sessionId: null, workoutId: null, date: '2026-10-09',
  performedAt: '2026-10-09T08:00:00-03:00', status: 'completed' as const,
  metrics: {
    distanceKm: { state: 'known' as const, value: 8 },
    durationMin: { state: 'known' as const, value: 51 },
    elevationGainM: { state: 'unknown' as const },
    avgHrBpm: { state: 'unknown' as const },
    rpe: { state: 'known' as const, value: 5 },
  },
  feeling: null, athleteNotes: 'original',
}

test('KAN-702 SQLite correction enforces owner, appends history and rolls back on audit failure', () => {
  for (const statement of setup) db.run(sql.raw(statement))
  db.run(sql.raw("INSERT INTO athlete_profiles VALUES ('self-a','team-a',0),('self-b','team-b',0)"))
  const created = createManualRealizedTrainingRecord(initial)
  const replacement = { ...initial, athleteNotes: 'corrected', metrics: {
    ...initial.metrics, distanceKm: { state: 'known' as const, value: 9 },
  } }
  const request = {
    workoutLogId: created.id, correctedByUserId: 'user-a',
    athleteId: 'self-a', reason: 'distance corrected', replacement,
  }

  assert.throws(() => correctManualRealizedTrainingRecord({ ...request, athleteId: 'self-b' }), /realized_training_record_not_found/)
  assert.deepEqual(listRealizedTrainingCorrections(created.id), [])

  const corrected = correctManualRealizedTrainingRecord(request)
  assert.deepEqual(corrected.metrics.distanceKm, { state: 'known', value: 9 })
  const history = listRealizedTrainingCorrections(created.id)
  assert.equal(history.length, 1)
  assert.equal(history[0]?.correctedByUserId, 'user-a')
  assert.equal(history[0]?.before.athleteNotes, 'original')
  assert.equal(history[0]?.after.athleteNotes, 'corrected')

  db.run(sql.raw("CREATE TRIGGER reject_correction_audit BEFORE INSERT ON workout_log_corrections BEGIN SELECT RAISE(ABORT, 'forced audit failure'); END"))
  assert.throws(() => correctManualRealizedTrainingRecord({
    ...request, replacement: { ...replacement, athleteNotes: 'must rollback' },
  }), /forced audit failure/)
  assert.equal(db.select({ notes: workoutLogs.athleteNotes }).from(workoutLogs).where(eq(workoutLogs.id, created.id)).get()?.notes, 'corrected')
  assert.equal(listRealizedTrainingCorrections(created.id).length, 1)
})
