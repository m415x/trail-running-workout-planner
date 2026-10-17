import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const initial = { kind: 'weight', unit: 'kg', valueScaled: 725, observedOn: '2026-10-17', operationKey: 'create_1' }
const correction = { ...initial, valueScaled: 730, operationKey: 'correct_1', supersedesObservationId: 'obs_1', correctionReason: 'Corrected measurement' }

test('KAN-646/T5 correction cannot proceed without an existing same-subject same-kind leaf', () => {
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
    const created = repository.create(subject, initial)
    assert.equal(created.status, 'created')
    if (created.status !== 'created') return
    const invalidTarget = repository.correct(subject, { ...correction, supersedesObservationId: 'absent' })
    assert.equal(invalidTarget.status, 'denied')
    const validCorrection = repository.correct(subject, { ...correction, supersedesObservationId: created.id })
    assert.equal(validCorrection.status, 'created')
    const stale = repository.correct(subject, { ...correction, operationKey: 'correct_2', supersedesObservationId: created.id })
    assert.equal(stale.status, 'denied')
    const original = db.prepare('SELECT value_scaled FROM athlete_biometric_observations WHERE id = ?').get(created.id) as { value_scaled: number }
    assert.equal(original.value_scaled, 725)
    assert.equal((db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 2)
  } finally { db.close() }
})
