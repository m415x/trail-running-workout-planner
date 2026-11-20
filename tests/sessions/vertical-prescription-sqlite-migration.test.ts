import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import Database from 'better-sqlite3'

test('KAN-878 RED-5 canonical SQLite migration adds nullable vertical columns and preserves legacy rows', () => {
  const root = resolve(import.meta.dirname, '../..')
  const journalPath = resolve(root, 'drizzle/sqlite/meta/_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>
  }
  const last = journal.entries.at(-1)

  assert.deepEqual(last, {
    ...last,
    idx: 29,
    tag: '0029_group_session_vertical_prescription',
  }, 'KAN-878 RED-5: append a new canonical migration after 0028 without rewriting history')

  const sqlPath = resolve(root, 'drizzle/sqlite/0029_group_session_vertical_prescription.sql')
  assert.ok(existsSync(sqlPath), 'KAN-878 RED-5: the additive SQL migration is missing')

  const sql = readFileSync(sqlPath, 'utf8').replaceAll('--> statement-breakpoint', '')
  const sqlite = new Database(':memory:')
  try {
    sqlite.exec(`
      CREATE TABLE group_session_prescriptions (
        id text PRIMARY KEY NOT NULL,
        session_id text NOT NULL,
        microcycle_id text NOT NULL,
        elevation_gain integer
      );
      CREATE UNIQUE INDEX group_session_prescriptions_session_microcycle_unique
        ON group_session_prescriptions(session_id, microcycle_id);
      INSERT INTO group_session_prescriptions
        (id, session_id, microcycle_id, elevation_gain)
      VALUES ('prescription-legacy', 'session-1', 'microcycle-1', 2400);
    `)

    sqlite.exec(sql)

    const columns = sqlite.pragma('table_info(group_session_prescriptions)') as Array<{
      name: string
      type: string
      notnull: number
    }>
    for (const columnName of ['primary_objective', 'vertical_block_json']) {
      const column = columns.find((item) => item.name === columnName)
      assert.ok(column, `Missing physical SQLite column: ${columnName}`)
      assert.equal(column.type.toLowerCase(), 'text')
      assert.equal(column.notnull, 0, `${columnName} must be nullable for legacy records`)
    }

    const row = sqlite.prepare(`
      SELECT session_id, microcycle_id, elevation_gain, primary_objective, vertical_block_json
      FROM group_session_prescriptions WHERE id = ?
    `).get('prescription-legacy')
    assert.deepEqual(row, {
      session_id: 'session-1',
      microcycle_id: 'microcycle-1',
      elevation_gain: 2400,
      primary_objective: null,
      vertical_block_json: null,
    }, 'Migration must preserve existing prescription data and default only the two new columns to NULL')

    assert.throws(() => sqlite.prepare(`
      INSERT INTO group_session_prescriptions (id, session_id, microcycle_id)
      VALUES ('duplicate', 'session-1', 'microcycle-1')
    `).run(), /UNIQUE/, 'Session + microcycle uniqueness must remain intact')
  } finally {
    sqlite.close()
  }
})
