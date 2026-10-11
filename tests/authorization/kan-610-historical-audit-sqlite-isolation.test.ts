import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { createSqliteFieldPerformanceTestRepository } from '../../lib/physiology/field-performance-test-sqlite'
import { readAuthorizedFieldPerformanceTestAuditHistory } from '../../lib/physiology/field-performance-test-application'

test('KAN-733 SQLite audit retains invalidated revisions and excludes other athlete records', async () => {
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE field_performance_tests (
        id TEXT PRIMARY KEY, athlete_id TEXT NOT NULL, performed_at TEXT NOT NULL,
        protocol TEXT NOT NULL, source TEXT NOT NULL, test_event_id TEXT,
        execution_context TEXT, recorded_by TEXT, recorded_by_user_id TEXT,
        reviewed_by_user_id TEXT, review_status TEXT, distance_m INTEGER NOT NULL,
        elapsed_time_sec REAL NOT NULL, notes TEXT, is_deleted INTEGER NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO field_performance_tests VALUES
        ('old', 'athlete-a', '2026-10-01', '1000m_track', 'coach_manual', NULL, NULL, NULL, NULL, NULL, NULL, 1000, 321, NULL, 1, '2026-10-01', '2026-10-02'),
        ('new', 'athlete-a', '2026-10-02', '1000m_track', 'coach_manual', NULL, NULL, NULL, 'coach-1', NULL, NULL, 1000, 302, NULL, 0, '2026-10-02', '2026-10-02'),
        ('other', 'athlete-b', '2026-10-03', '1000m_track', 'coach_manual', NULL, NULL, NULL, 'other-user', NULL, NULL, 1000, 299, NULL, 0, '2026-10-03', '2026-10-03');
    `)
    const repository = createSqliteFieldPerformanceTestRepository(drizzle(sqlite))
    let reads = 0
    const result = await readAuthorizedFieldPerformanceTestAuditHistory('athlete-a', {
      resolveOwnedAthlete: async () => ({ id: 'athlete-a' }),
      listAllByAthlete: id => { reads++; return repository.listAllByAthlete(id) },
    })
    assert.equal(result.success, true)
    if (!result.success) return
    assert.deepEqual(result.data.map(row => row.id), ['old', 'new'])
    assert.equal(result.data[0].recordedByUserId, null)
    assert.equal(result.data[0].isDeleted, true)
    assert.equal(reads, 1)
    const deny = await readAuthorizedFieldPerformanceTestAuditHistory('athlete-b', {
      resolveOwnedAthlete: async () => null,
      listAllByAthlete: id => { reads++; return repository.listAllByAthlete(id) },
    })
    assert.deepEqual(deny, { success: false, error: 'athlete_not_found' })
    assert.equal(reads, 1)
  } finally {
    sqlite.close()
  }
})
