import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

const owner = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const initial = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'create_1' }

test('KAN-646/T5 correction denies cross-Team, cross-athlete and different-kind targets without mutation', () => {
  const db = new Database(':memory:')
  try {
    db.exec(`CREATE TABLE athlete_biometric_observations (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
      kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
      observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL, recorded_by_user_id TEXT NOT NULL,
      source TEXT NOT NULL, supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
      request_digest TEXT NOT NULL, correction_reason TEXT,
      UNIQUE(team_id, athlete_profile_id, recorded_by_user_id, operation_key),
      UNIQUE(supersedes_observation_id)
    )`)
    const repository = createBiometricSelfSqliteRepository(db)
    const original = repository.create(owner, initial)
    assert.equal(original.status, 'created')
    if (original.status !== 'created') return
    const correction = {
      ...initial, operationKey: 'correct_1', valueScaled: 730,
      supersedesObservationId: original.id, correctionReason: 'Corrected measurement',
    }
    const attempts = [
      { subject: { ...owner, teamId: 'team_2' }, input: correction },
      { subject: { ...owner, athleteProfileId: 'athlete_b' }, input: correction },
      { subject: owner, input: { ...correction, kind: 'height', unit: 'cm', valueScaled: 1800 } },
    ]
    for (const attempt of attempts) {
      assert.deepEqual(repository.correct(attempt.subject, attempt.input), { status: 'denied' })
      assert.equal((db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 1)
    }
    const row = db.prepare('SELECT value_scaled, supersedes_observation_id FROM athlete_biometric_observations WHERE id = ?').get(original.id) as { value_scaled: number; supersedes_observation_id: string | null }
    assert.deepEqual(row, { value_scaled: 725, supersedes_observation_id: null })
  } finally { db.close() }
})
