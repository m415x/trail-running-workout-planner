import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'

const GUARD = 'SELECT * FROM "__kan615_dedicated_executor_required__";'

test('KAN-615 canonical 0016 refuses generic SQL execution', () => {
  const journal = JSON.parse(
    readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8'),
  ) as {
    entries: Array<{
      idx: number
      tag: string
      when: number
    }>
  }

  assert.equal(journal.entries.length, 17)

  const entry = journal.entries[16]

  assert.equal(entry.idx, 16)
  assert.equal(entry.tag, '0016_athlete_profile_identity')
  assert.ok(entry.when > journal.entries[15].when)

  const sql = readFileSync(
    `drizzle/sqlite/${entry.tag}.sql`,
    'utf8',
  ).trim()

  assert.equal(
    sql,
    GUARD,
    '0016 must be a fail-closed guard, not a generic table rebuild',
  )

  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    migrateKan615Historical0015(sqlite)
    seedKan615PreservationData(sqlite)

    const beforeSchema = sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      ORDER BY type, name
    `).all()

    const beforeHistory = sqlite.prepare(`
      SELECT rowid, id, hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all()

    assert.throws(
      () => sqlite.exec(sql),
      error =>
        error instanceof Error &&
        /no such table.*__kan615_dedicated_executor_required__/i
          .test(error.message),
    )

    assert.deepEqual(
      sqlite.prepare(`
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        ORDER BY type, name
      `).all(),
      beforeSchema,
    )

    assert.deepEqual(
      sqlite.prepare(`
        SELECT rowid, id, hash, created_at
        FROM __drizzle_migrations
        ORDER BY rowid
      `).all(),
      beforeHistory,
    )

    assert.equal(
      (sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM monthly_charges
      `).get() as { count: number }).count,
      1,
    )

    assert.equal(sqlite.inTransaction, false)
    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
