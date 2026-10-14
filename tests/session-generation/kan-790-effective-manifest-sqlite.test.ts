import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewSnapshotEffectiveManifestSqlite } from '@/lib/session-generation/review-snapshot-effective-manifest-sqlite'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_race_name TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, period TEXT NOT NULL);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL, target_elevation_gain INTEGER, target_duration_min INTEGER);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, maximum_weekly_volume_km REAL NOT NULL, initial_weekly_volume_km REAL NOT NULL);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL);
    CREATE TABLE microcycle_intensity_targets (id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL, emphasis TEXT NOT NULL, reference_percentage_target REAL, minimum_recovery_days_between_intense_sessions INTEGER NOT NULL);
    CREATE TABLE session_generation_preferences (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, frequency_mode TEXT NOT NULL, fixed_sessions_per_week INTEGER, weekly_pattern TEXT NOT NULL);
    CREATE TABLE workouts (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, archived_at TEXT, category TEXT NOT NULL, tags TEXT NOT NULL, title TEXT NOT NULL, type TEXT NOT NULL, distance REAL, time INTEGER, gain INTEGER, intensity_method TEXT, zone TEXT, reference_percentage REAL, notes TEXT, prescription_notes TEXT, structure TEXT, track_path TEXT, location_key TEXT);
    CREATE TABLE competition_entries (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL, date TEXT NOT NULL, distance_km REAL NOT NULL, elevation_gain_m REAL, priority TEXT NOT NULL, status TEXT NOT NULL, description TEXT);
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0,'2027-01-01','2027-12-31',NULL,NULL,NULL);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0,'general_preparatory');
    INSERT INTO microcycles VALUES ('week-a','meso-a',0,1,'base','2027-01-04','2027-01-10',40,700,300);
    INSERT INTO load_strategies VALUES ('load-a','plan-a',0,100,30);
    INSERT INTO intensity_strategies VALUES ('int-a','plan-a',0,'hr_zone',2);
    INSERT INTO microcycle_intensity_targets VALUES ('target-a','week-a',0,2,'Z2','aerobic',NULL,2);
    INSERT INTO session_generation_preferences VALUES ('prefs-a','plan-a',0,'auto',NULL,'[{"weekday":"monday","role":"base"},{"weekday":"wednesday","role":"quality"},{"weekday":"saturday","role":"long"}]');
    INSERT INTO workouts VALUES ('work-a','team-a',0,NULL,'endurance','[]','Easy','Trail',10,60,300,'hr_zone','Z2',NULL,NULL,NULL,NULL,NULL,NULL);
    INSERT INTO competition_entries VALUES ('race-a','plan-a',0,'Race','2027-05-01',21,800,'A','planned',NULL);
  `)
  return db
}

test('KAN-790 T5.3 reads and fingerprints effective generation inputs directly from scoped SQL', () => {
  const db = fixture()
  try {
    const first = readReviewSnapshotEffectiveManifestSqlite(db, scope)
    const second = readReviewSnapshotEffectiveManifestSqlite(db, scope)
    assert.ok(first)
    assert.deepEqual(first, second)
    assert.equal(first.groupTrainingPlanId, 'plan-a')
    assert.equal(first.manifestVersion, 1)
    assert.equal(first.generationInputCount, 1)
    assert.match(first.generationInputSha256, /^[a-f0-9]{64}$/)
    assert.equal(evaluateReviewSnapshotSourceFreshness(first, second).kind, 'current')
  } finally { db.close() }
})

test('KAN-790 T5.3 persisted changes to effective planning and template facts invalidate a fresh SQL manifest', () => {
  const db = fixture()
  try {
    let previous = readReviewSnapshotEffectiveManifestSqlite(db, scope)
    assert.ok(previous)
    for (const query of [
      "UPDATE microcycles SET target_volume_km = 45 WHERE id = 'week-a'",
      "UPDATE microcycle_intensity_targets SET emphasis = 'tempo' WHERE id = 'target-a'",
      "UPDATE load_strategies SET maximum_weekly_volume_km = 110 WHERE id = 'load-a'",
      "UPDATE session_generation_preferences SET frequency_mode = 'fixed', fixed_sessions_per_week = 3 WHERE id = 'prefs-a'",
      "UPDATE workouts SET distance = 12 WHERE id = 'work-a'",
    ]) {
      db.exec(query)
      const current = readReviewSnapshotEffectiveManifestSqlite(db, scope)
      assert.ok(current)
      assert.equal(evaluateReviewSnapshotSourceFreshness(previous, current).kind, 'generation_stale')
      previous = current
    }
  } finally { db.close() }
})

test('KAN-790 T5.3 SQL manifest refuses mismatched Team/Group/deleted Plan without writes', () => {
  const db = fixture()
  try {
    const changes = () => (db.prepare('SELECT total_changes() AS count').get() as { count: number }).count
    const before = changes()
    assert.equal(readReviewSnapshotEffectiveManifestSqlite(db, { ...scope, teamId: 'team-b' }), null)
    assert.equal(readReviewSnapshotEffectiveManifestSqlite(db, { ...scope, groupId: 'group-b' }), null)
    assert.ok(readReviewSnapshotEffectiveManifestSqlite(db, scope))
    assert.equal(changes(), before)
    db.exec("UPDATE group_training_plans SET is_deleted = 1 WHERE id = 'plan-a'")
    assert.equal(readReviewSnapshotEffectiveManifestSqlite(db, scope), null)
  } finally { db.close() }
})
