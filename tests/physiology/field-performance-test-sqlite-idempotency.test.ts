import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import { fieldPerformanceTests } from '../../db/schema'
import { createSqliteFieldPerformanceTestRepository } from '../../lib/physiology/field-performance-test-sqlite'

describe('official 1000m SQLite idempotency', () => {
  it('exposes a newly inserted official result to the duplicate lookup immediately', () => {
    const sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE field_performance_tests (
        id TEXT PRIMARY KEY NOT NULL,
        athlete_id TEXT NOT NULL,
        performed_at TEXT NOT NULL,
        protocol TEXT NOT NULL,
        source TEXT NOT NULL,
        test_event_id TEXT,
        execution_context TEXT,
        recorded_by TEXT,
        recorded_by_user_id TEXT,
        review_status TEXT,
        distance_m INTEGER NOT NULL,
        elapsed_time_sec REAL NOT NULL,
        notes TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `)

    const db = drizzle(sqlite)
    const repository = createSqliteFieldPerformanceTestRepository(db)

    repository.insert({
      id: 'evidence-1',
      athleteId: 'athlete-1',
      performedAt: '2026-09-24',
      protocol: '1000m_track',
      source: 'coach_manual',
      testEventId: 'event-1',
      executionContext: 'official',
      recordedBy: 'coach',
      recordedByUserId: null,
      reviewStatus: 'accepted',
      distanceM: 1000,
      elapsedTimeSec: 300,
      notes: null,
      createdAt: '2026-09-24T12:00:00.000Z',
      updatedAt: '2026-09-24T12:00:00.000Z',
    })

    const existing = repository.findActiveOfficialByAthleteAndTestEvent('athlete-1', 'event-1')
    const active = repository.listActiveByAthlete('athlete-1').filter(
      row => row.testEventId === 'event-1' && row.executionContext === 'official',
    )

    assert.equal(existing?.id, 'evidence-1')
    assert.equal(active.length, 1)
    assert.equal(db.select().from(fieldPerformanceTests).all().length, 1)

    sqlite.close()
  })
})
