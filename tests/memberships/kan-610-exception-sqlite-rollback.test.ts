import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'

test('KAN-730 SQLite rollback prevents partial exception revision and charge updates', () => {
  const db = new Database(':memory:')
  try {
    db.exec("CREATE TABLE global_monthly_due_date_exceptions (id text PRIMARY KEY, is_current integer NOT NULL, created_by_user_id text)")
    db.exec("CREATE TABLE monthly_charges (id text PRIMARY KEY, effective_due_date text NOT NULL)")
    db.exec("INSERT INTO global_monthly_due_date_exceptions VALUES ('old', 1, NULL)")
    db.exec("INSERT INTO monthly_charges VALUES ('charge-a', '2026-10-10')")
    const operation = db.transaction(() => {
      db.prepare("UPDATE global_monthly_due_date_exceptions SET is_current = 0 WHERE id = 'old'").run()
      db.prepare("INSERT INTO global_monthly_due_date_exceptions VALUES ('new', 1, 'coach-1')").run()
      db.prepare("UPDATE monthly_charges SET effective_due_date = '2026-10-15' WHERE id = 'charge-a'").run()
      throw new Error('injected failure')
    })
    assert.throws(() => operation(), /injected failure/)
    assert.deepEqual(db.prepare('SELECT id, is_current, created_by_user_id FROM global_monthly_due_date_exceptions').all(), [{ id: 'old', is_current: 1, created_by_user_id: null }])
    assert.deepEqual(db.prepare('SELECT id, effective_due_date FROM monthly_charges').all(), [{ id: 'charge-a', effective_due_date: '2026-10-10' }])
  } finally {
    db.close()
  }
})
