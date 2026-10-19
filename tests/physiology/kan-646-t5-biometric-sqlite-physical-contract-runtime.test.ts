import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import test from 'node:test'

test('KAN-646/T5 actual 0027 migration enforces biometric checks, replay uniqueness and correction fork constraints', () => {
  const journal = JSON.parse(readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8')) as {
    entries: { tag: string }[]
  }
  const tag = journal.entries.find((entry) => entry.tag.startsWith('0027_'))?.tag
  assert.ok(tag, 'canonical SQLite 0027 migration exists')
  const migration = readFileSync('drizzle/sqlite/' + tag + '.sql', 'utf8')
  const db = new Database(':memory:')
  try {
    db.pragma('foreign_keys = ON')
    // The migration is applied as authored, not reconstructed in the test.
    // Referenced parents are minimal stand-ins; a full upgraded seed remains a separate gate.
    db.exec('CREATE TABLE teams (id TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY);')
    db.exec(migration.replaceAll('--> statement-breakpoint', ''))
    db.exec("INSERT INTO teams VALUES ('team_1'); INSERT INTO users VALUES ('user_a'); INSERT INTO athlete_profiles VALUES ('athlete_a');")
    const sql = `INSERT INTO athlete_biometric_observations
      (id, team_id, athlete_profile_id, kind, value_scaled, unit, observed_on,
       recorded_at, recorded_by_user_id, source, supersedes_observation_id,
       operation_key, request_digest, correction_reason)
      VALUES (?, 'team_1', 'athlete_a', ?, ?, ?, '2026-10-17',
              '2026-10-17T12:00:00Z', 'user_a', 'athlete_declared', ?, ?, ?, ?)`
    const insert = db.prepare(sql)
    insert.run('obs_1', 'weight', 725, 'kg', null, 'op_1', 'digest_1', null)
    assert.throws(() => insert.run('bad_unit', 'weight', 725, 'bpm', null, 'op_2', 'digest_2', null))
    assert.throws(() => insert.run('bad_range', 'weight', 1, 'kg', null, 'op_3', 'digest_3', null))
    assert.throws(() => insert.run('replay_duplicate', 'weight', 725, 'kg', null, 'op_1', 'digest_1', null))
    insert.run('obs_2', 'weight', 730, 'kg', 'obs_1', 'op_4', 'digest_4', 'reason')
    assert.throws(() => insert.run('fork', 'weight', 735, 'kg', 'obs_1', 'op_5', 'digest_5', 'reason'))
    assert.equal((db.prepare('SELECT count(*) AS n FROM athlete_biometric_observations').get() as { n: number }).n, 2)
  } finally {
    db.close()
  }
})
