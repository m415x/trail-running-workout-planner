import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfWriter } from '@/lib/physiology/biometric-self-writer'
import { createPersistedAuthorizedBiometricSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-authorized-repository'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const input = { kind: 'weight', unit: 'kg', value: '72.5', observedOn: '2026-10-17', operationKey: 'create_1' }

test('KAN-646/T5 guarded writer delegates only valid SELF input to same-connection authorized SQLite transaction', async () => {
  const db = new Database(':memory:')
  try {
    db.exec(`
      CREATE TABLE team_memberships (user_id TEXT, team_id TEXT, preset TEXT, effective_from TEXT, effective_until TEXT, is_active INTEGER, is_deleted INTEGER);
      CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY, user_id TEXT, team_id TEXT, is_active INTEGER, is_deleted INTEGER);
      CREATE TABLE teams (id TEXT PRIMARY KEY, time_zone TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
      INSERT INTO teams (id, time_zone) VALUES ('team_1', 'America/Argentina/San_Juan');
      CREATE TABLE athlete_biometric_observations (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
        kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
        observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
        source TEXT NOT NULL, supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
        request_digest TEXT NOT NULL, correction_reason TEXT, observed_time_zone TEXT,
        UNIQUE(team_id, athlete_profile_id, recorded_by_user_id, operation_key),
        UNIQUE(supersedes_observation_id)
      );
      INSERT INTO team_memberships VALUES ('user_a','team_1','athlete','2026-01-01T00:00:00.000Z',NULL,1,0);
      INSERT INTO athlete_profiles VALUES ('athlete_a','user_a','team_1',1,0);
    `)
    const repo = createPersistedAuthorizedBiometricSqliteRepository(db, () => '2026-10-17T12:00:00.000Z')
    const writer = createBiometricSelfWriter({
      authorize: async () => subject,
      today: () => '2026-10-17',
      persist: async (resolved, validated) => repo.create(resolved, validated),
    })
    const first = await writer.create(input)
    assert.equal(first.status, 'persisted')
    if (first.status !== 'persisted') return
    assert.equal(first.result.status, 'created')
    db.exec('UPDATE team_memberships SET is_active = 0')
    const denied = await writer.create(input)
    assert.deepEqual(denied, { status: 'denied' })
    assert.equal((db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 1)
  } finally { db.close() }
})
