import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
import test from 'node:test'

import { createBiometricSelfSqliteRepository } from '@/lib/physiology/biometric-self-sqlite-repository'

const subject = { status: 'resolved', userId: 'user_a', teamId: 'team_1', athleteProfileId: 'athlete_a' } as const
const input = {
  kind: 'weight', unit: 'kg', valueScaled: 725,
  observedOn: '2026-10-17', operationKey: 'op_a',
}

/** Disposable in-memory database; no access to repository sqlite.db. */
function fixture() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE athlete_biometric_observations (
      id TEXT PRIMARY KEY, team_id TEXT NOT NULL, athlete_profile_id TEXT NOT NULL,
      kind TEXT NOT NULL, value_scaled INTEGER NOT NULL, unit TEXT NOT NULL,
      observed_on TEXT NOT NULL, recorded_at TEXT NOT NULL,
      recorded_by_user_id TEXT NOT NULL, source TEXT NOT NULL,
      supersedes_observation_id TEXT, operation_key TEXT NOT NULL,
      request_digest TEXT NOT NULL, correction_reason TEXT,
      UNIQUE(team_id, athlete_profile_id, recorded_by_user_id, operation_key),
      UNIQUE(supersedes_observation_id),
      CHECK(source = 'athlete_declared')
    );
  `)
  return sqlite
}

test('KAN-646/T5 SQLite CREATE persists exactly once and safely replays same canonical request', () => {
  const sqlite = fixture()
  try {
    const repository = createBiometricSelfSqliteRepository(sqlite)
    const first = repository.create(subject, input)
    assert.equal(first.status, 'created')
    assert.deepEqual(repository.create(subject, input), { status: 'replayed', id: 'id' in first ? first.id : null })
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 1)
    const row = sqlite.prepare('SELECT team_id, athlete_profile_id, recorded_by_user_id, source, value_scaled FROM athlete_biometric_observations').get() as Record<string, unknown>
    assert.deepEqual(row, { team_id: 'team_1', athlete_profile_id: 'athlete_a', recorded_by_user_id: 'user_a', source: 'athlete_declared', value_scaled: 725 })
  } finally { sqlite.close() }
})

test('KAN-646/T5 SQLite same operation key with changed payload conflicts without mutation', () => {
  const sqlite = fixture()
  try {
    const repository = createBiometricSelfSqliteRepository(sqlite)
    const first = repository.create(subject, input)
    assert.equal(first.status, 'created')
    assert.deepEqual(repository.create(subject, { ...input, valueScaled: 730 }), { status: 'conflict' })
    const row = sqlite.prepare('SELECT value_scaled FROM athlete_biometric_observations').get() as { value_scaled: number }
    assert.equal(row.value_scaled, 725)
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 1)
  } finally { sqlite.close() }
})

test('KAN-646/T5 SQLite insert error rolls back the transaction', () => {
  const sqlite = fixture()
  try {
    sqlite.exec("CREATE TRIGGER reject_biometric BEFORE INSERT ON athlete_biometric_observations BEGIN SELECT RAISE(ABORT, 'forced rollback'); END;")
    const repository = createBiometricSelfSqliteRepository(sqlite)
    assert.throws(() => repository.create(subject, input), /forced rollback/)
    assert.equal((sqlite.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 0)
  } finally { sqlite.close() }
})
