import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createSqliteFieldPerformanceTestRepository } from '../../lib/physiology/field-performance-test-sqlite'

test('KAN-732 SQLite review retains recorder, stores H2 reviewer and rejects replay', () => {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  try {
    sqlite.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      INSERT INTO users VALUES ('athlete-actor'), ('coach-reviewer');
      CREATE TABLE field_performance_tests (
        id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL, performed_at TEXT NOT NULL,
        protocol TEXT NOT NULL, source TEXT NOT NULL, test_event_id TEXT,
        execution_context TEXT, recorded_by TEXT, recorded_by_user_id TEXT,
        reviewed_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
        review_status TEXT, distance_m INTEGER NOT NULL, elapsed_time_sec REAL NOT NULL,
        notes TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO field_performance_tests VALUES (
        'evidence-1', 'athlete-1', '2026-10-10', '1000m_track', 'athlete_manual', NULL,
        'self_directed', 'athlete', 'athlete-actor', NULL, 'pending_review',
        1000, 300, NULL, 0, '2026-10-10T10:00:00Z', '2026-10-10T10:00:00Z'
      );
    `)
    const repo = createSqliteFieldPerformanceTestRepository(drizzle(sqlite))
    const reviewed = repo.review('evidence-1', 'accepted', '2026-10-10T12:00:00Z', 'coach-reviewer')
    assert.equal(reviewed.recordedByUserId, 'athlete-actor')
    assert.equal(reviewed.reviewedByUserId, 'coach-reviewer')
    assert.equal(reviewed.reviewStatus, 'accepted')
    assert.throws(() => repo.review('evidence-1', 'rejected', '2026-10-10T13:00:00Z', 'coach-reviewer'), /pending_review/)
    const row = sqlite.prepare("SELECT recorded_by_user_id, reviewed_by_user_id, review_status, updated_at FROM field_performance_tests WHERE id = 'evidence-1'").get() as Record<string, unknown>
    assert.deepEqual(row, { recorded_by_user_id: 'athlete-actor', reviewed_by_user_id: 'coach-reviewer', review_status: 'accepted', updated_at: '2026-10-10T12:00:00Z' })
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally { sqlite.close() }
})
