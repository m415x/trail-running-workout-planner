import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanStrategyFactsSqlite } from '@/lib/session-generation/review-snapshot-plan-strategies-sqlite'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, maximum_weekly_volume_km REAL NOT NULL, initial_weekly_volume_km REAL NOT NULL);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE microcycle_intensity_targets (
      id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      emphasis TEXT NOT NULL, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL,
      reference_percentage_target REAL,
      minimum_recovery_days_between_intense_sessions INTEGER NOT NULL,
      field_sources TEXT NOT NULL
    );
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0);
    INSERT INTO load_strategies VALUES ('load-a','plan-a',0,100,30);
    INSERT INTO intensity_strategies VALUES ('int-a','plan-a',0,'reference_percentage',2);
    INSERT INTO macrocycles VALUES ('macro-a','plan-a',0);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0);
    INSERT INTO microcycles VALUES ('micro-a','meso-a',0);
    INSERT INTO microcycle_intensity_targets VALUES
      ('target-a','micro-a',0,'threshold',2,'Z4',88,2,'{}');
  `)
  return sqlite
}

test('KAN-790 T5.3 captures all intensity-target values consumed by SessionGenerationInput', () => {
  const sqlite = fixture()
  try {
    const target = readReviewPlanStrategyFactsSqlite(sqlite, scope)?.intensityTargets[0]
    assert.ok(target)
    assert.equal(target.emphasis, 'threshold')
    assert.equal(target.referencePercentageTarget, 88)
    assert.equal(target.minimumRecoveryDaysBetweenIntenseSessions, 2)
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 detects changes of emphasis, reference percentage and recovery days as stale sources', () => {
  const sqlite = fixture()
  try {
    for (const [column, value] of [
      ['emphasis', 'tempo'],
      ['reference_percentage_target', 92],
      ['minimum_recovery_days_between_intense_sessions', 3],
    ] as const) {
      const before = readReviewPlanStrategyFactsSqlite(sqlite, scope)
      assert.ok(before)
      sqlite.prepare(`UPDATE microcycle_intensity_targets SET ${column} = ? WHERE id = ?`).run(value, 'target-a')
      const after = readReviewPlanStrategyFactsSqlite(sqlite, scope)
      assert.ok(after)
      assert.equal(evaluateReviewSnapshotSourceFreshness(before, after).kind, 'generation_stale')
    }
  } finally { sqlite.close() }
})
