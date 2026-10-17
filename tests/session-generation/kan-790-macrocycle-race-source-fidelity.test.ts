import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanPeriodizationFactsSqlite } from '@/lib/session-generation/review-snapshot-plan-periodization-sqlite'
import { evaluateReviewSnapshotSourceFreshness } from '@/lib/session-generation/review-snapshot-source-freshness'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE macrocycles (
      id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_race_name TEXT,
      target_race_distance_km REAL, target_race_elevation_gain INTEGER
    );
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, period TEXT NOT NULL);
    CREATE TABLE microcycles (
      id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL,
      end_date TEXT NOT NULL, target_volume_km REAL, target_elevation_gain INTEGER,
      target_duration_min INTEGER
    );
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO macrocycles VALUES
      ('macro-a','plan-a',0,'2027-01-01','2027-06-30','Alpine Race',42,2000),
      ('macro-b','plan-b',0,'2027-01-01','2027-06-30','Other Race',21,900);
    INSERT INTO mesocycles VALUES ('meso-a','macro-a',0,'competitive'),('meso-b','macro-b',0,'competitive');
    INSERT INTO microcycles VALUES
      ('week-a','meso-a',0,20,'race','2027-06-24','2027-06-30',30,500,180),
      ('week-b','meso-b',0,20,'race','2027-06-24','2027-06-30',25,400,150);
  `)
  return sqlite
}

test('KAN-790 T5.3 retains macrocycle race context consumed by effective generation input', () => {
  const sqlite = fixture()
  try {
    const facts = readReviewPlanPeriodizationFactsSqlite(sqlite, scope)
    assert.equal(facts?.microcycles.length, 1)
    const week = facts?.microcycles[0]
    assert.equal(week?.macrocycleEndDate, '2027-06-30')
    assert.equal(week?.macrocycleTargetRaceName, 'Alpine Race')
    assert.equal(week?.macrocycleTargetRaceDistanceKm, 42)
    assert.equal(week?.macrocycleTargetRaceElevationGain, 2000)
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 changing macrocycle race name, distance, elevation or end date invalidates SQL source evidence', () => {
  const sqlite = fixture()
  try {
    for (const [column, value] of [
      ['target_race_name', 'Revised Race'],
      ['target_race_distance_km', 50],
      ['target_race_elevation_gain', 2500],
      ['end_date', '2027-07-01'],
    ] as const) {
      const before = readReviewPlanPeriodizationFactsSqlite(sqlite, scope)
      assert.ok(before)
      sqlite.prepare(`UPDATE macrocycles SET ${column} = ? WHERE id = ?`).run(value, 'macro-a')
      const after = readReviewPlanPeriodizationFactsSqlite(sqlite, scope)
      assert.ok(after)
      assert.equal(evaluateReviewSnapshotSourceFreshness(before, after).kind, 'generation_stale')
    }
  } finally { sqlite.close() }
})
