import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanPeriodizationFactsSqlite } from '@/lib/session-generation/review-snapshot-plan-periodization-sqlite'

function fixture() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_race_name TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, period TEXT NOT NULL);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL, target_elevation_gain INTEGER, target_duration_min INTEGER);
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0,'2026-01-01','2026-12-31',NULL,NULL,NULL),('macro-b','plan-b',0,'2026-01-01','2026-12-31',NULL,NULL,NULL);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0,'base'),('meso-b','macro-b',0,'base');
    INSERT INTO microcycles VALUES ('week-a','meso-a',0,1,'base','2026-01-05','2026-01-11',40,600,300),('week-b','meso-b',0,1,'base','2026-01-05','2026-01-11',50,700,360);
  `)
  return db
}
const scope = { teamId: 'team-a', groupId: 'group-a', groupTrainingPlanId: 'plan-a' }

test('KAN-790 T5.3 reads persisted Plan microcycle source facts under exact Team and Group', () => {
  const db = fixture()
  try {
    const facts = readReviewPlanPeriodizationFactsSqlite(db, scope)
    assert.equal(facts?.groupTrainingPlanId, 'plan-a')
    assert.equal(facts?.teamId, 'team-a')
    assert.equal(facts?.groupId, 'group-a')
    assert.deepEqual(facts?.microcycles.map(m => m.id), ['week-a'])
    assert.equal(facts?.microcycles[0]?.targetVolumeKm, 40)
  } finally { db.close() }
})

test('KAN-790 T5.3 source re-read reflects changed persisted microcycle targets', () => {
  const db = fixture()
  try {
    const before = readReviewPlanPeriodizationFactsSqlite(db, scope)
    db.prepare('UPDATE microcycles SET target_volume_km = ? WHERE id = ?').run(45, 'week-a')
    const after = readReviewPlanPeriodizationFactsSqlite(db, scope)
    assert.notDeepEqual(after, before)
    assert.equal(after?.microcycles[0]?.targetVolumeKm, 45)
  } finally { db.close() }
})

test('KAN-790 T5.3 wrong Team, wrong Group and deleted Plan fail closed', () => {
  const db = fixture()
  try {
    assert.equal(readReviewPlanPeriodizationFactsSqlite(db, { ...scope, teamId: 'team-b' }), null)
    assert.equal(readReviewPlanPeriodizationFactsSqlite(db, { ...scope, groupId: 'group-b' }), null)
    db.prepare('UPDATE group_training_plans SET is_deleted = 1 WHERE id = ?').run('plan-a')
    assert.equal(readReviewPlanPeriodizationFactsSqlite(db, scope), null)
  } finally { db.close() }
})

test('KAN-790 T5.3 soft-deleted microcycle disappears from current source facts', () => {
  const db = fixture()
  try {
    const before = readReviewPlanPeriodizationFactsSqlite(db, scope)
    db.prepare('UPDATE microcycles SET is_deleted = 1 WHERE id = ?').run('week-a')
    const after = readReviewPlanPeriodizationFactsSqlite(db, scope)
    assert.notDeepEqual(after, before)
    assert.deepEqual(after?.microcycles, [])
  } finally { db.close() }
})
