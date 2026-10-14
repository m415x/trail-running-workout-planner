import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanStrategyFactsSqlite } from '@/lib/session-generation/review-snapshot-plan-strategies-sqlite'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, maximum_weekly_volume_km REAL NOT NULL, initial_weekly_volume_km REAL NOT NULL);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycle_intensity_targets (id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL);
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO load_strategies VALUES ('load-a','plan-a',0,100,30),('load-b','plan-b',0,80,20);
    INSERT INTO intensity_strategies VALUES ('int-a','plan-a',0,'zone',2),('int-b','plan-b',0,'zone',3);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0),('macro-b','plan-b',0);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0),('meso-b','macro-b',0);
    INSERT INTO microcycles VALUES ('micro-a','meso-a',0),('micro-b','meso-b',0);
    INSERT INTO microcycle_intensity_targets VALUES ('target-a','micro-a',0,2,'Z2'),('target-b','micro-b',0,3,'Z3');
  `)
  return db
}

test('KAN-790 T5.3 reads Plan-scoped persisted strategy inputs and microcycle targets', () => {
  const db = fixture()
  try {
    const facts = readReviewPlanStrategyFactsSqlite(db, scope)
    assert.equal(facts?.groupTrainingPlanId, 'plan-a')
    assert.equal(facts?.loadStrategy?.maximumWeeklyVolumeKm, 100)
    assert.equal(facts?.intensityStrategy?.defaultMethod, 'zone')
    assert.deepEqual(facts?.intensityTargets.map(target => target.microcycleId), ['micro-a'])
  } finally { db.close() }
})

test('KAN-790 T5.3 fresh SQL read observes changed strategy and target facts', () => {
  const db = fixture()
  try {
    const before = readReviewPlanStrategyFactsSqlite(db, scope)
    db.prepare('UPDATE load_strategies SET maximum_weekly_volume_km = 120 WHERE id = ?').run('load-a')
    db.prepare('UPDATE microcycle_intensity_targets SET intense_sessions_target = 1 WHERE id = ?').run('target-a')
    const after = readReviewPlanStrategyFactsSqlite(db, scope)
    assert.notDeepEqual(after, before)
    assert.equal(after?.loadStrategy?.maximumWeeklyVolumeKm, 120)
    assert.equal(after?.intensityTargets[0]?.intenseSessionsTarget, 1)
  } finally { db.close() }
})

test('KAN-790 T5.3 rejects wrong Team and Group without exposure of sibling strategy facts', () => {
  const db = fixture()
  try {
    assert.equal(readReviewPlanStrategyFactsSqlite(db, { ...scope, teamId: 'team-b' }), null)
    assert.equal(readReviewPlanStrategyFactsSqlite(db, { ...scope, groupId: 'group-b' }), null)
    assert.deepEqual(readReviewPlanStrategyFactsSqlite(db, scope)?.intensityTargets.map(t => t.microcycleId), ['micro-a'])
  } finally { db.close() }
})

test('KAN-790 T5.3 deleted strategies or microcycle targets do not survive current source read', () => {
  const db = fixture()
  try {
    db.exec("UPDATE load_strategies SET is_deleted = 1 WHERE id = 'load-a'; UPDATE microcycle_intensity_targets SET is_deleted = 1 WHERE id = 'target-a'")
    const facts = readReviewPlanStrategyFactsSqlite(db, scope)
    assert.equal(facts?.loadStrategy, null)
    assert.deepEqual(facts?.intensityTargets, [])
  } finally { db.close() }
})
