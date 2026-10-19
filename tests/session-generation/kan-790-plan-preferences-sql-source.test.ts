import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanGenerationPreferencesSqlite } from '@/lib/session-generation/review-snapshot-plan-preferences-sqlite'

const scope = { groupTrainingPlanId: 'plan-a', teamId: 'team-a', groupId: 'group-a' }

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE session_generation_preferences (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0, frequency_mode TEXT NOT NULL, fixed_sessions_per_week INTEGER, weekly_pattern TEXT NOT NULL);
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0),('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-a','group-a',0),('plan-b','group-b',0);
    INSERT INTO session_generation_preferences VALUES ('prefs-a','plan-a',0,'fixed',4,'[{"weekday":"mon","role":"easy"}]'),('prefs-b','plan-b',0,'fixed',5,'[]');
  `)
  return sqlite
}

test('KAN-790 T5.3 reads persisted preferences only from authorized Plan scope', () => {
  const sqlite = fixture()
  try {
    const facts = readReviewPlanGenerationPreferencesSqlite(sqlite, scope)
    assert.equal(facts?.groupTrainingPlanId, 'plan-a')
    assert.equal(facts?.frequencyMode, 'fixed')
    assert.equal(facts?.fixedSessionsPerWeek, 4)
    assert.deepEqual(facts?.weeklyPattern, [{ weekday: 'mon', role: 'easy' }])
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 re-reading preferences observes changed frequency and pattern', () => {
  const sqlite = fixture()
  try {
    const before = readReviewPlanGenerationPreferencesSqlite(sqlite, scope)
    sqlite.prepare('UPDATE session_generation_preferences SET fixed_sessions_per_week = ?, weekly_pattern = ? WHERE id = ?').run(3, '[]', 'prefs-a')
    const after = readReviewPlanGenerationPreferencesSqlite(sqlite, scope)
    assert.notDeepEqual(after, before)
    assert.equal(after?.fixedSessionsPerWeek, 3)
    assert.deepEqual(after?.weeklyPattern, [])
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 denies cross-Team and cross-Group preference reads and deleted Plans', () => {
  const sqlite = fixture()
  try {
    assert.equal(readReviewPlanGenerationPreferencesSqlite(sqlite, { ...scope, teamId: 'team-b' }), null)
    assert.equal(readReviewPlanGenerationPreferencesSqlite(sqlite, { ...scope, groupId: 'group-b' }), null)
    sqlite.prepare('UPDATE group_training_plans SET is_deleted = 1 WHERE id = ?').run('plan-a')
    assert.equal(readReviewPlanGenerationPreferencesSqlite(sqlite, scope), null)
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 deleted or malformed stored preferences cannot be treated as current facts', () => {
  const sqlite = fixture()
  try {
    sqlite.prepare('UPDATE session_generation_preferences SET weekly_pattern = ? WHERE id = ?').run('{invalid', 'prefs-a')
    assert.throws(() => readReviewPlanGenerationPreferencesSqlite(sqlite, scope), /invalid|pattern|json|source/i)
    sqlite.prepare('UPDATE session_generation_preferences SET is_deleted = 1 WHERE id = ?').run('prefs-a')
    assert.equal(readReviewPlanGenerationPreferencesSqlite(sqlite, scope), null)
  } finally { sqlite.close() }
})
