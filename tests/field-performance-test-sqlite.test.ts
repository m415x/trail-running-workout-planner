import assert from 'node:assert/strict'
import test from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { athleteProfiles, fieldPerformanceTests } from '@/db/schema'
import { createSqliteFieldPerformanceTestRepository } from '@/lib/physiology/field-performance-test-sqlite'

function createRepository() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE athlete_profiles (id TEXT PRIMARY KEY NOT NULL);
    CREATE TABLE field_performance_tests (
      id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER DEFAULT 0 NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      athlete_id TEXT NOT NULL REFERENCES athlete_profiles(id) ON DELETE CASCADE,
      performed_at TEXT NOT NULL,
      protocol TEXT NOT NULL CHECK (protocol = '1000m_track'),
      distance_m INTEGER NOT NULL CHECK (distance_m = 1000),
      elapsed_time_sec REAL NOT NULL CHECK (elapsed_time_sec > 0), notes TEXT
    );
  `)
  sqlite.prepare('INSERT INTO athlete_profiles (id) VALUES (?)').run('athlete_1')
  return createSqliteFieldPerformanceTestRepository(
    drizzle(sqlite, { schema: { athleteProfiles, fieldPerformanceTests } }),
  )
}

test('appends repeated evaluations and lists active history chronologically', () => {
  const repository = createRepository()
  repository.insert({ id: 'eval_1', athleteId: 'athlete_1', performedAt: '2026-09-17', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 298, notes: null, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' })
  repository.insert({ id: 'eval_2', athleteId: 'athlete_1', performedAt: '2026-08-27', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 305, notes: 'monthly control', createdAt: '2026-08-27T12:00:00.000Z', updatedAt: '2026-08-27T12:00:00.000Z' })
  assert.deepEqual(repository.listActiveByAthlete('athlete_1').map((row) => row.id), ['eval_2', 'eval_1'])
})

test('invalidation preserves observed evidence and excludes it from active history', () => {
  const repository = createRepository()
  repository.insert({ id: 'eval_1', athleteId: 'athlete_1', performedAt: '2026-09-17', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 298, notes: null, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' })
  repository.invalidate('eval_1', '2026-09-19T15:00:00.000Z')
  assert.deepEqual(repository.listActiveByAthlete('athlete_1'), [])
  const stored = repository.getById('eval_1')
  assert.equal(stored?.isDeleted, true)
  assert.equal(stored?.elapsedTimeSec, 298)
  assert.equal(stored?.updatedAt, '2026-09-19T15:00:00.000Z')
})
