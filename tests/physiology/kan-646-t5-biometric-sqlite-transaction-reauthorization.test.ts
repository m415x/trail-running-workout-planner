import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const input = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'create_1' }

test('KAN-646/T5 SQLite checks current SELF authority INSIDE the write transaction, including replay and corrections', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`CREATE TABLE teams (id TEXT PRIMARY KEY, time_zone TEXT, is_deleted INTEGER NOT NULL DEFAULT 0);
      INSERT INTO teams (id, time_zone) VALUES ('team_1', 'America/Argentina/San_Juan');
      CREATE TABLE athlete_biometric_observations (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
      kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
      observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
      source TEXT NOT NULL, supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
      request_digest TEXT NOT NULL, correction_reason TEXT, observed_time_zone TEXT,
      UNIQUE(team_id, athlete_profile_id, recorded_by_user_id, operation_key),
      UNIQUE(supersedes_observation_id)
    )`)
    let authorized = true
    let checks = 0
    const repository = createBiometricSelfSqliteRepository(db, {
      reauthorizeInTransaction: (candidate) => {
        assert.equal(db.inTransaction, true)
        assert.deepEqual(candidate, subject)
        checks++
        return authorized
      },
    })
    const created = repository.create(subject, input)
    assert.equal(created.status, 'created')
    if (created.status !== 'created') return

    authorized = false // Model a revoked TeamMembership since the first request.
    assert.deepEqual(repository.create(subject, input), { status: 'denied' })
    assert.deepEqual(repository.create(subject, { ...input, operationKey: 'create_2' }), { status: 'denied' })
    assert.deepEqual(repository.correct(subject, {
      ...input, operationKey: 'correct_1', valueScaled: 730,
      supersedesObservationId: created.id, correctionReason: 'New reading',
    }), { status: 'denied' })
    assert.equal(checks, 4)
    assert.equal((db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 1)
  } finally { db.close() }
})
