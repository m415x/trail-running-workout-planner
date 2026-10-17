import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import Database from 'better-sqlite3'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

test('KAN-646 Block A SQLite writes snapshot Team IANA timezone and deny missing region even on replay', () => {
  const db = new Database(':memory:')
  const teamId = 'team-' + randomUUID()
  const subject = { status: 'resolved', userId: 'self', teamId, athleteProfileId: 'self-profile' } as const
  const input = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'key-a' }
  try {
    db.exec(`
      CREATE TABLE teams (id TEXT PRIMARY KEY, time_zone TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE athlete_biometric_observations (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
        kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
        observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
        source TEXT NOT NULL, supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
        request_digest TEXT NOT NULL, correction_reason TEXT, observed_time_zone TEXT
      );
    `)
    db.prepare('INSERT INTO teams(id,time_zone) VALUES (?,?)').run(teamId, null)
    const repository = createBiometricSelfSqliteRepository(db, { reauthorizeInTransaction: () => true })
    assert.deepEqual(repository.create(subject, input), { status: 'denied' })
    assert.equal(db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get()?.n, 0)

    db.prepare('UPDATE teams SET time_zone=? WHERE id=?').run('America/Argentina/San_Juan', teamId)
    assert.equal(repository.create(subject, input).status, 'created')
    const first = db.prepare('SELECT observed_time_zone FROM athlete_biometric_observations WHERE operation_key=?').get('key-a') as {observed_time_zone:string}
    assert.equal(first.observed_time_zone, 'America/Argentina/San_Juan')

    db.prepare('UPDATE teams SET time_zone=? WHERE id=?').run('America/Bogota', teamId)
    assert.equal(repository.create(subject, { ...input, operationKey: 'key-b' }).status, 'created')
    const zones = db.prepare('SELECT observed_time_zone FROM athlete_biometric_observations ORDER BY operation_key').all() as {observed_time_zone:string}[]
    assert.deepEqual(zones.map(row => row.observed_time_zone), ['America/Argentina/San_Juan','America/Bogota'])

    db.prepare('UPDATE teams SET time_zone=? WHERE id=?').run('Invalid/Region', teamId)
    assert.deepEqual(repository.create(subject, input), { status: 'denied' })
    assert.equal(db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get()?.n, 2)
  } finally { db.close() }
})
