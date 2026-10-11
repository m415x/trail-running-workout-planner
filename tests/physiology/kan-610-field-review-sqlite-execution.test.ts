import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-732 SQLite 0024 preserves legacy evidence and enforces reviewer FK', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  try {
    db.exec('CREATE TABLE users (id text PRIMARY KEY)')
    db.exec('CREATE TABLE field_performance_tests (id text PRIMARY KEY, review_status text)')
    db.exec("INSERT INTO users VALUES ('reviewer-1')")
    db.exec("INSERT INTO field_performance_tests VALUES ('legacy-1', 'pending_review')")
    const migration = readFileSync('drizzle/sqlite/0024_h7a_field_review_author.sql', 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) db.exec(statement)
    const historic = db.prepare("SELECT reviewed_by_user_id FROM field_performance_tests WHERE id = 'legacy-1'").get() as { reviewed_by_user_id: string | null }
    assert.equal(historic.reviewed_by_user_id, null)
    const fks = db.pragma('foreign_key_list(field_performance_tests)') as Array<{ from: string; table: string; on_delete: string }>
    assert.ok(fks.some(fk => fk.from === 'reviewed_by_user_id' && fk.table === 'users' && fk.on_delete.toUpperCase() === 'RESTRICT'))
    assert.throws(() => db.exec("UPDATE field_performance_tests SET reviewed_by_user_id = 'missing' WHERE id = 'legacy-1'"), /FOREIGN KEY constraint failed/i)
    db.exec("UPDATE field_performance_tests SET reviewed_by_user_id = 'reviewer-1' WHERE id = 'legacy-1'")
    assert.throws(() => db.exec("DELETE FROM users WHERE id = 'reviewer-1'"), /FOREIGN KEY constraint failed/i)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  } finally { db.close() }
})
