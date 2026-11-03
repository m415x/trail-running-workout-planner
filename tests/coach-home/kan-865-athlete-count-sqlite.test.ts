import assert from 'node:assert/strict'
import test from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import type { db } from '@/db'
import { createCoachHomeActiveAthleteCountQuery } from '@/lib/coach-home/athlete-count-query'

test('KAN-865/T2: one bounded SQLite count filters active, nondeleted Team profiles without PII', async () => {
  const sqlStatements: string[] = []
  const sqlite = new Database(':memory:', { verbose: (sql) => { if (typeof sql === 'string') sqlStatements.push(sql) } })
  try {
    sqlite.exec(`
      CREATE TABLE athlete_profiles (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL,
        is_active INTEGER NOT NULL,
        is_deleted INTEGER NOT NULL
      );
      INSERT INTO athlete_profiles VALUES
        ('A1','team_A',1,0),
        ('A2','team_A',1,0),
        ('A3','team_A',0,0),
        ('A4','team_A',1,1),
        ('B1','team_B',1,0);
    `)
    sqlStatements.length = 0

    const scopedDatabase = drizzle(sqlite) as unknown as typeof db
    const read = createCoachHomeActiveAthleteCountQuery(scopedDatabase)
    assert.equal(await read('team_A'), 2)
    assert.equal(await read('team_B'), 1)
    assert.equal(await read('team_C'), 0)

    const selects = sqlStatements.filter((sql) => /^select\b/i.test(sql.trim()))
    assert.equal(selects.length, 3, 'one SELECT aggregate per Team, not a full list or per-athlete queries')
    for (const sql of selects) {
      assert.match(sql, /count\(/i)
      assert.match(sql, /team_id/i)
      assert.match(sql, /is_active/i)
      assert.match(sql, /is_deleted/i)
      assert.doesNotMatch(sql, /join\s+users|contact_email|first_name|last_name/i)
    }
    assert.equal(sqlStatements.some((sql) => /^(insert|update|delete)\b/i.test(sql.trim())), false)
  } finally {
    sqlite.close()
  }
})
