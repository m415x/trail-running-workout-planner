import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

import { readReviewPlanCompetitionCalendarFactsSqlite } from '@/lib/session-generation/review-snapshot-competition-calendar-sqlite'

const base = { groupTrainingPlanId: 'plan-base', teamId: 'team-a', groupId: 'group-a' }
const variant = { ...base, groupTrainingPlanId: 'plan-variant' }

function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE competition_entries (
      id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL, date TEXT NOT NULL, distance_km REAL NOT NULL, elevation_gain_m REAL,
      priority TEXT NOT NULL, status TEXT NOT NULL, description TEXT
    );
    INSERT INTO athlete_groups VALUES ('group-a','team-a',0), ('group-b','team-b',0);
    INSERT INTO group_training_plans VALUES ('plan-base','group-a',0), ('plan-variant','group-a',0), ('plan-other','group-b',0);
    INSERT INTO competition_entries VALUES
      ('race-base','plan-base',0,'Base Race','2027-04-10',21,900,'A','planned',NULL),
      ('race-history','plan-base',0,'Past Race','2027-02-10',10,300,'C','completed',NULL),
      ('race-variant','plan-variant',0,'Variant Race','2027-05-01',42,2000,'A','confirmed',NULL),
      ('race-other','plan-other',0,'Other Team','2027-05-04',42,2000,'A','planned',NULL),
      ('race-deleted','plan-base',1,'Deleted Race','2027-03-01',5,100,'B','cancelled',NULL);
  `)
  return sqlite
}

test('KAN-790 T5.3 SQL calendar retains non-deleted Plan-owned entries without leaking Variant or sibling Team', () => {
  const sqlite = fixture()
  try {
    const facts = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base)
    assert.equal(facts?.groupTrainingPlanId, 'plan-base')
    assert.deepEqual(facts?.competitions.map(entry => entry.id), ['race-history', 'race-base'])
    assert.deepEqual(facts?.competitions.map(entry => entry.status), ['completed', 'planned'])
    assert.equal(facts?.competitions[1]?.distanceKm, 21)
    assert.deepEqual(readReviewPlanCompetitionCalendarFactsSqlite(sqlite, variant)?.competitions.map(entry => entry.id), ['race-variant'])
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 SQL calendar re-read detects date, priority and lifecycle changes', () => {
  const sqlite = fixture()
  try {
    const before = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base)
    sqlite.prepare("UPDATE competition_entries SET date = ?, priority = ?, status = ? WHERE id = ?")
      .run('2027-04-17', 'B', 'confirmed', 'race-base')
    const after = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base)
    assert.notDeepEqual(after, before)
    assert.equal(after?.competitions[1]?.date, '2027-04-17')
    assert.equal(after?.competitions[1]?.priority, 'B')
    assert.equal(after?.competitions[1]?.status, 'confirmed')
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 calendar SQL denies wrong Team, wrong Group or deleted Plan', () => {
  const sqlite = fixture()
  try {
    assert.equal(readReviewPlanCompetitionCalendarFactsSqlite(sqlite, { ...base, teamId: 'team-b' }), null)
    assert.equal(readReviewPlanCompetitionCalendarFactsSqlite(sqlite, { ...base, groupId: 'group-b' }), null)
    sqlite.prepare("UPDATE group_training_plans SET is_deleted = 1 WHERE id = ?").run('plan-base')
    assert.equal(readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base), null)
  } finally { sqlite.close() }
})

test('KAN-790 T5.3 calendar deletion changes current facts without borrowing sibling Plan competitions', () => {
  const sqlite = fixture()
  try {
    const before = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base)
    sqlite.prepare('UPDATE competition_entries SET is_deleted = 1 WHERE id = ?').run('race-base')
    const after = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, base)
    assert.notDeepEqual(after, before)
    assert.deepEqual(after?.competitions.map(entry => entry.id), ['race-history'])
  } finally { sqlite.close() }
})
