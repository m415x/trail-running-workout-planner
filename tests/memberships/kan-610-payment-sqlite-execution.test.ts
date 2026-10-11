import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-731 SQLite payment author migration keeps legacy rows and FK constraints', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  try {
    db.exec('CREATE TABLE users (id text PRIMARY KEY)')
    db.exec('CREATE TABLE payment_revisions (id text PRIMARY KEY, payment_id text NOT NULL)')
    db.exec("INSERT INTO users VALUES ('coach-1')")
    db.exec("INSERT INTO payment_revisions VALUES ('legacy-1', 'payment-1')")
    const migration = readFileSync('drizzle/sqlite/0023_h7a_payment_author.sql', 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) db.exec(statement)
    const legacy = db.prepare("SELECT created_by_user_id FROM payment_revisions WHERE id = 'legacy-1'").get() as { created_by_user_id: string | null }
    assert.equal(legacy.created_by_user_id, null)
    const fk = db.pragma('foreign_key_list(payment_revisions)') as Array<{ from: string; table: string; on_delete: string }>
    assert.ok(fk.some(row => row.from === 'created_by_user_id' && row.table === 'users' && row.on_delete.toUpperCase() === 'RESTRICT'))
    assert.throws(() => db.exec("UPDATE payment_revisions SET created_by_user_id = 'missing' WHERE id = 'legacy-1'"), /FOREIGN KEY constraint failed/i)
    db.exec("UPDATE payment_revisions SET created_by_user_id = 'coach-1' WHERE id = 'legacy-1'")
    assert.throws(() => db.exec("DELETE FROM users WHERE id = 'coach-1'"), /FOREIGN KEY constraint failed/i)
    assert.deepEqual(db.pragma('foreign_key_check'), [])
  } finally { db.close() }
})
