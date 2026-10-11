import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-732 migration 0025 preserves TestEvents, referencing evidence, and creator RESTRICT', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  try {
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE teams (id TEXT PRIMARY KEY);
      CREATE TABLE athlete_groups (id TEXT PRIMARY KEY);
      INSERT INTO users VALUES ('creator');
      INSERT INTO teams VALUES ('team-1');
      INSERT INTO athlete_groups VALUES ('group-1');
      CREATE TABLE field_performance_test_events (
        id TEXT PRIMARY KEY NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,
        scheduled_at TEXT NOT NULL, protocol TEXT NOT NULL,
        created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX field_performance_test_events_team_group_date_idx
        ON field_performance_test_events(team_id, group_id, scheduled_at);
      CREATE TABLE field_performance_tests (
        id TEXT PRIMARY KEY,
        test_event_id TEXT REFERENCES field_performance_test_events(id) ON DELETE RESTRICT
      );
      INSERT INTO field_performance_test_events VALUES
        ('event-1',0,'2026-10-10','2026-10-10','team-1','group-1','2026-10-10','1000m_track','creator'),
        ('legacy-event',0,'2026-10-10','2026-10-10','team-1','group-1','2026-10-10','1000m_track',NULL);
      INSERT INTO field_performance_tests VALUES ('evidence-1','event-1');
    `)
    const sql = readFileSync('drizzle/sqlite/0025_h7a_test_event_author_retention.sql', 'utf8')
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) db.exec(statement)
    const events = db.prepare('SELECT id, created_by_user_id FROM field_performance_test_events ORDER BY id').all()
    assert.deepEqual(events, [
      { id: 'event-1', created_by_user_id: 'creator' },
      { id: 'legacy-event', created_by_user_id: null },
    ])
    assert.deepEqual(db.prepare('SELECT id, test_event_id FROM field_performance_tests').all(),
      [{ id: 'evidence-1', test_event_id: 'event-1' }])
    const fk = db.pragma('foreign_key_list(field_performance_test_events)') as Array<{from:string;table:string;on_delete:string}>
    assert.ok(fk.some(row => row.from === 'created_by_user_id' && row.table === 'users' && row.on_delete.toUpperCase() === 'RESTRICT'))
    assert.throws(() => db.exec("DELETE FROM users WHERE id='creator'"), /FOREIGN KEY constraint failed/)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  } finally {
    db.close()
  }
})
