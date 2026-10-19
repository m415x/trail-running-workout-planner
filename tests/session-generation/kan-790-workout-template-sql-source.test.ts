import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewWorkoutTemplateFactsSqlite } from '@/lib/session-generation/review-snapshot-workout-templates-sqlite'

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE workouts (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      archived_at TEXT, category TEXT NOT NULL, tags TEXT NOT NULL, title TEXT NOT NULL,
      type TEXT NOT NULL, distance REAL, time INTEGER, gain INTEGER,
      intensity_method TEXT, zone TEXT, reference_percentage REAL, notes TEXT,
      prescription_notes TEXT, structure TEXT, track_path TEXT, location_key TEXT
    );
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO workouts VALUES
      ('template-a','team-a',0,NULL,'easy','["base"]','Easy Trail','Trail',12,75,350,'hr_zone','Z2',NULL,'steady','prescription',NULL,NULL,NULL),
      ('template-archived','team-a',0,'2026-10-01','easy','[]','Old Trail','Trail',9,55,250,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
      ('template-deleted','team-a',1,NULL,'easy','[]','Deleted','Trail',9,55,250,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL),
      ('template-b','team-b',0,NULL,'easy','[]','Other Team','Trail',20,120,900,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);
  `)
  return sqlite
}
const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

test('KAN-790 T5.3 reads active Team template catalogue only for scoped Plan', () => {
  const sqlite = fixture()
  try {
    const facts = readReviewWorkoutTemplateFactsSqlite(sqlite, scope)
    assert.equal(facts?.groupTrainingPlanId, 'plan-a')
    assert.deepEqual(facts?.templates.map(item => item.id), ['template-a'])
    assert.equal(facts?.templates[0]?.distanceKm, 12)
    assert.deepEqual(facts?.templates[0]?.tags, ['base'])
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 repeated read detects persisted template edits and archival', () => {
  const sqlite = fixture()
  try {
    const before = readReviewWorkoutTemplateFactsSqlite(sqlite, scope)
    sqlite.prepare('UPDATE workouts SET distance = 14 WHERE id = ?').run('template-a')
    const changed = readReviewWorkoutTemplateFactsSqlite(sqlite, scope)
    assert.notDeepEqual(changed, before)
    assert.equal(changed?.templates[0]?.distanceKm, 14)
    sqlite.prepare('UPDATE workouts SET archived_at = ? WHERE id = ?').run('2026-10-14', 'template-a')
    assert.deepEqual(readReviewWorkoutTemplateFactsSqlite(sqlite, scope)?.templates, [])
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 rejects cross-Team, cross-Group and deleted Plan template reads', () => {
  const sqlite = fixture()
  try {
    assert.equal(readReviewWorkoutTemplateFactsSqlite(sqlite, { ...scope, teamId: 'team-b' }), null)
    assert.equal(readReviewWorkoutTemplateFactsSqlite(sqlite, { ...scope, groupId: 'group-b' }), null)
    sqlite.prepare('UPDATE group_training_plans SET is_deleted = 1 WHERE id = ?').run('plan-a')
    assert.equal(readReviewWorkoutTemplateFactsSqlite(sqlite, scope), null)
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 malformed template tags are not treated as source evidence', () => {
  const sqlite = fixture()
  try {
    sqlite.prepare('UPDATE workouts SET tags = ? WHERE id = ?').run('{bad', 'template-a')
    assert.throws(() => readReviewWorkoutTemplateFactsSqlite(sqlite, scope), /invalid|json|tags|source/i)
  } finally { sqlite.close() }
})
