import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSqlitePersistedReauthorization } from '@/lib/physiology/biometric-self-sqlite-reauthorization'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const at = '2026-10-17T12:00:00.000Z'

test('KAN-646/T5 SQLite transaction-local authorization checks current persisted membership and linked profile', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`
      CREATE TABLE team_memberships (user_id TEXT, team_id TEXT, preset TEXT, effective_from TEXT, effective_until TEXT, is_active INTEGER, is_deleted INTEGER);
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, user_id TEXT, team_id TEXT, is_active INTEGER, is_deleted INTEGER);
      INSERT INTO team_memberships VALUES ('user_a', 'team_1', 'athlete', '2026-01-01T00:00:00.000Z', NULL, 1, 0);
      INSERT INTO athlete_profiles VALUES ('athlete_a', 'user_a', 'team_1', 1, 0);
    `)
    const reauthorize = createBiometricSqlitePersistedReauthorization(db, () => at, 'physiology.biometric.self.manage')
    assert.equal(reauthorize(subject), true)
    db.exec("UPDATE team_memberships SET is_active = 0")
    assert.equal(reauthorize(subject), false)
    db.exec("UPDATE team_memberships SET is_active = 1; UPDATE athlete_profiles SET is_active = 0")
    assert.equal(reauthorize(subject), false)
    db.exec("UPDATE athlete_profiles SET is_active = 1; INSERT INTO team_memberships VALUES ('user_a','team_1','athlete','2026-01-01T00:00:00.000Z',NULL,1,0)")
    assert.equal(reauthorize(subject), false)
  } finally { db.close() }
})

test('KAN-646/T5 persisted reauthorization refuses foreign Team/profile and time-expired membership', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`
      CREATE TABLE team_memberships (user_id TEXT, team_id TEXT, preset TEXT, effective_from TEXT, effective_until TEXT, is_active INTEGER, is_deleted INTEGER);
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, user_id TEXT, team_id TEXT, is_active INTEGER, is_deleted INTEGER);
      INSERT INTO team_memberships VALUES ('user_a', 'team_1', 'athlete', '2026-01-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z', 1, 0);
      INSERT INTO athlete_profiles VALUES ('athlete_a', 'user_a', 'team_1', 1, 0);
    `)
    const reauthorize = createBiometricSqlitePersistedReauthorization(db, () => at, 'physiology.biometric.self.manage')
    assert.equal(reauthorize(subject), false)
    db.exec("UPDATE team_memberships SET effective_until = NULL")
    assert.equal(reauthorize({ ...subject, teamId: 'team_2' }), false)
    assert.equal(reauthorize({ ...subject, athleteProfileId: 'athlete_b' }), false)
  } finally { db.close() }
})
