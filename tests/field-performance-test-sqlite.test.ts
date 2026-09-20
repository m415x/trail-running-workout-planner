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
      elapsed_time_sec REAL NOT NULL CHECK (elapsed_time_sec > 0),
      source TEXT NOT NULL CHECK (source = 'coach_manual'), notes TEXT
    );
  `)
  sqlite.prepare('INSERT INTO athlete_profiles (id) VALUES (?)').run('athlete_1')
  sqlite.prepare('INSERT INTO athlete_profiles (id) VALUES (?)').run('athlete_2')
  return createSqliteFieldPerformanceTestRepository(
    drizzle(sqlite, { schema: { athleteProfiles, fieldPerformanceTests } }),
  )
}

test('appends repeated evaluations and lists active history chronologically', () => {
  const repository = createRepository()
  repository.insert({ id: 'eval_1', athleteId: 'athlete_1', performedAt: '2026-09-17', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 298, source: 'coach_manual', notes: null, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' })
  repository.insert({ id: 'eval_2', athleteId: 'athlete_1', performedAt: '2026-08-27', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 305, source: 'coach_manual', notes: 'monthly control', createdAt: '2026-08-27T12:00:00.000Z', updatedAt: '2026-08-27T12:00:00.000Z' })
  assert.deepEqual(repository.listActiveByAthlete('athlete_1').map((row) => row.id), ['eval_2', 'eval_1'])
})

test('invalidation preserves observed evidence and excludes it from active history', () => {
  const repository = createRepository()
  repository.insert({ id: 'eval_1', athleteId: 'athlete_1', performedAt: '2026-09-17', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 298, source: 'coach_manual', notes: null, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' })
  repository.invalidate('eval_1', '2026-09-19T15:00:00.000Z')
  assert.deepEqual(repository.listActiveByAthlete('athlete_1'), [])
  const stored = repository.getById('eval_1')
  assert.equal(stored?.isDeleted, true)
  assert.equal(stored?.elapsedTimeSec, 298)
  assert.equal(stored?.source, 'coach_manual')
  assert.equal(stored?.updatedAt, '2026-09-19T15:00:00.000Z')
})


test('correction is atomic when replacement persistence fails', () => {
  const repository = createRepository()
  repository.insert({ id: 'eval_1', athleteId: 'athlete_1', performedAt: '2026-09-17', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 298, source: 'coach_manual', notes: null, createdAt: '2026-09-17T12:00:00.000Z', updatedAt: '2026-09-17T12:00:00.000Z' })
  repository.insert({ id: 'duplicate_id', athleteId: 'athlete_1', performedAt: '2026-09-18', protocol: '1000m_track', distanceM: 1000, elapsedTimeSec: 297, source: 'coach_manual', notes: null, createdAt: '2026-09-18T12:00:00.000Z', updatedAt: '2026-09-18T12:00:00.000Z' })

  assert.throws(
    () => repository.replace(
      'eval_1',
      {
        id: 'duplicate_id',
        athleteId: 'athlete_1',
        performedAt: '2026-09-19',
        protocol: '1000m_track',
        distanceM: 1000,
        elapsedTimeSec: 296,
        source: 'coach_manual',
        notes: 'corrected',
        createdAt: '2026-09-19T12:00:00.000Z',
        updatedAt: '2026-09-19T12:00:00.000Z',
      },
      '2026-09-19T12:00:00.000Z',
    ),
    /UNIQUE constraint failed: field_performance_tests\.id/,
  )

  const original = repository.getById('eval_1')
  assert.equal(original?.isDeleted, false)
  assert.equal(original?.updatedAt, '2026-09-17T12:00:00.000Z')
})


test('lists only active athlete evidence eligible at the effective date', () => {
  const repository = createRepository()
  const insert = (id: string, athleteId: string, performedAt: string, createdAt: string) =>
    repository.insert({
      id, athleteId, performedAt, protocol: '1000m_track', distanceM: 1000,
      elapsedTimeSec: 300, source: 'coach_manual', notes: null, createdAt, updatedAt: createdAt,
    })

  insert('old', 'athlete_1', '2026-09-01', '2026-09-01T12:00:00.000Z')
  insert('boundary_b', 'athlete_1', '2026-09-17', '2026-09-17T13:00:00.000Z')
  insert('boundary_a', 'athlete_1', '2026-09-17', '2026-09-17T12:00:00.000Z')
  insert('future', 'athlete_1', '2026-09-18', '2026-09-18T12:00:00.000Z')
  insert('other', 'athlete_2', '2026-09-10', '2026-09-10T12:00:00.000Z')
  repository.invalidate('old', '2026-09-19T12:00:00.000Z')

  assert.deepEqual(
    repository.listActiveByAthleteThroughDate('athlete_1', '2026-09-17').map((row) => row.id),
    ['boundary_a', 'boundary_b'],
  )
})


test('persists official instance and lifecycle dimensions independently', () => {
  const repository = createRepository()

  const stored = repository.insert({
    id: 'eval_lifecycle',
    athleteId: 'athlete_1',
    performedAt: '2026-09-24',
    protocol: '1000m_track',
    distanceM: 1000,
    elapsedTimeSec: 298,
    source: 'athlete_manual',
    testEventId: 'event_2026_09',
    executionContext: 'official',
    recordedBy: 'athlete',
    reviewStatus: 'accepted',
    isEligible: true,
    notes: null,
    createdAt: '2026-09-24T12:00:00.000Z',
    updatedAt: '2026-09-24T12:00:00.000Z',
  })

  assert.equal(stored.testEventId, 'event_2026_09')
  assert.equal(stored.executionContext, 'official')
  assert.equal(stored.recordedBy, 'athlete')
  assert.equal(stored.reviewStatus, 'accepted')
  assert.equal(stored.isEligible, true)
})
