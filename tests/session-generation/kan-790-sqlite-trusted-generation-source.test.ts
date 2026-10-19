import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { generateReviewSnapshotFromEffectiveSqlite } from '@/lib/session-generation/review-snapshot-generate-sqlite'
import { readReviewSnapshotEffectiveManifestSqlite } from '@/lib/session-generation/review-snapshot-effective-manifest-sqlite'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE teams (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE planning_cohorts (id TEXT PRIMARY KEY NOT NULL);
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
    INSERT INTO users VALUES ('coach');
    INSERT INTO teams VALUES ('team-a');
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
  db.exec(readFileSync('drizzle/sqlite/0026_session_generation_review_snapshots.sql', 'utf8'))
  return db
}

test('KAN-790 T5.3 generator obtains proposal, explanations and initial manifest from the same scoped SQL', () => {
  const db = fixture()
  try {
    const generated = generateReviewSnapshotFromEffectiveSqlite(db, { ...scope, planningCohortId: null })
    assert.deepEqual(generated.sourceManifest, readReviewSnapshotEffectiveManifestSqlite(db, scope))
    assert.ok(generated.proposal.events.length > 0)
    assert.equal(generated.sessionCount, generated.proposal.events.length)
    assert.equal(generated.microcycleCount, 1)
    assert.ok(Object.keys(generated.generationExplanations).length > 0)
    for (const event of generated.proposal.events) {
      for (const item of event.prescriptions) {
        assert.equal(item.prescription.groupId, scope.groupId)
        assert.equal(item.prescription.microcycleId, 'week-a')
        assert.ok(generated.generationExplanations[item.generationKey])
      }
    }
  } finally { db.close() }
})

test('KAN-790 T5.3 generation is read-only and uses current persisted volume', () => {
  const db = fixture()
  try {
    const changes = () => (db.prepare('SELECT total_changes() AS count').get() as { count: number }).count
    const before = changes()
    const oldGenerated = generateReviewSnapshotFromEffectiveSqlite(db, { ...scope, planningCohortId: null })
    assert.equal(changes(), before)
    db.prepare("UPDATE microcycles SET target_volume_km = 55 WHERE id = 'week-a'").run()
    const newGenerated = generateReviewSnapshotFromEffectiveSqlite(db, { ...scope, planningCohortId: null })
    assert.notDeepEqual(newGenerated.sourceManifest, oldGenerated.sourceManifest)
  } finally { db.close() }
})

test('KAN-790 T5.3 generation denies Team/Group mismatch before creating any proposal', () => {
  const db = fixture()
  try {
    assert.throws(
      () => generateReviewSnapshotFromEffectiveSqlite(db, { ...scope, teamId: 'team-b', planningCohortId: null }),
      /denied|missing|invalid|scope/i,
    )
    assert.throws(
      () => generateReviewSnapshotFromEffectiveSqlite(db, { ...scope, groupId: 'group-b', planningCohortId: null }),
      /denied|missing|invalid|scope/i,
    )
    assert.equal((db.prepare('SELECT count(*) AS n FROM session_generation_review_snapshots').get() as { n: number }).n, 0)
  } finally { db.close() }
})
