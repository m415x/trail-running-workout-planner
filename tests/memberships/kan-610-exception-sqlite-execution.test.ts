import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-730 SQLite 0022 preserves legacy exceptions and enforces nullable author FKs', () => {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  try {
    db.exec('CREATE TABLE users (id text PRIMARY KEY)')
    db.exec("INSERT INTO users (id) VALUES ('coach-1')")
    for (const table of ['global_monthly_due_date_exceptions', 'monthly_charge_reductions', 'monthly_charge_extensions']) {
      db.exec('CREATE TABLE ' + table + ' (id text PRIMARY KEY, reason text NOT NULL)')
      db.prepare('INSERT INTO ' + table + ' (id, reason) VALUES (?, ?)').run('historic-' + table, 'legacy')
    }
    const migration = readFileSync('drizzle/sqlite/0022_h7a_exception_authors.sql', 'utf8')
    for (const statement of migration.split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean)) db.exec(statement)
    for (const table of ['global_monthly_due_date_exceptions', 'monthly_charge_reductions', 'monthly_charge_extensions']) {
      const historical = db.prepare('SELECT created_by_user_id FROM ' + table + ' WHERE id = ?').get('historic-' + table) as { created_by_user_id: string | null }
      assert.equal(historical.created_by_user_id, null, table + ' must retain unknown historical author')
      assert.ok((db.pragma('foreign_key_list(' + table + ')') as Array<{ from: string; table: string; on_delete: string }>).some(fk => fk.from === 'created_by_user_id' && fk.table === 'users' && fk.on_delete.toUpperCase() === 'RESTRICT'), table + ' author FK must RESTRICT deletes')
      assert.throws(() => db.prepare('UPDATE ' + table + ' SET created_by_user_id = ? WHERE id = ?').run('unknown-user', 'historic-' + table), /FOREIGN KEY constraint failed/i)
      db.prepare('UPDATE ' + table + ' SET created_by_user_id = ? WHERE id = ?').run('coach-1', 'historic-' + table)
      assert.throws(() => db.prepare('DELETE FROM users WHERE id = ?').run('coach-1'), /FOREIGN KEY constraint failed/i)
    }
  } finally {
    db.close()
  }
})
