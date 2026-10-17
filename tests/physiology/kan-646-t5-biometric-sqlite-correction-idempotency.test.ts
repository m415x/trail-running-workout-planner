import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const initial = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'create_1' }

test('KAN-646/T5 correction replays identical key/payload but rejects changed payload without mutation', () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`CREATE TABLE athlete_biometric_observations (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
      kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
      observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
      source TEXT NOT NULL, supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
      request_digest TEXT NOT NULL, correction_reason TEXT,
      UNIQUE(team_id, athlete_profile_id, recorded_by_user_id, operation_key),
      UNIQUE(supersedes_observation_id)
    )`)
    const repository = createBiometricSelfSqliteRepository(sqlite, { reauthorizeInTransaction: () => true })
    const original = repository.create(subject, initial)
    assert.equal(original.status, 'created')
    if (original.status !== 'created') return

    const correction = {
      ...initial, valueScaled: 730, operationKey: 'correct_1',
      supersedesObservationId: original.id, correctionReason: 'Measurement correction',
    }
    const first = repository.correct(subject, correction)
    assert.equal(first.status, 'created')
    if (first.status !== 'created') return

    assert.deepEqual(repository.correct(subject, correction), { status: 'replayed', id: first.id })
    assert.deepEqual(repository.correct(subject, { ...correction, valueScaled: 735 }), { status: 'conflict' })
    assert.deepEqual(repository.correct(subject, { ...correction, correctionReason: 'Different reason' }), { status: 'conflict' })
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 2)
    assert.deepEqual(
      sqlite.prepare('SELECT value_scaled, correction_reason FROM athlete_biometric_observations WHERE id = ?').get(first.id),
      { value_scaled: 730, correction_reason: 'Measurement correction' },
    )
  } finally { sqlite.close() }
})
