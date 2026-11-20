import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

test('KAN-878 RED-10 appends canonical PostgreSQL vertical migration without rewriting prescription identity', () => {
  const root = resolve(import.meta.dirname, '../..')
  const migrations = resolve(root, 'drizzle/supabase')
  const journal = JSON.parse(readFileSync(resolve(migrations, 'meta/_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string; when: number }>
  }
  assert.equal(journal.entries.length, 44, 'History through 0042 must be retained plus exactly 0043')
  const previous = journal.entries[42]
  const last = journal.entries[43]
  assert.equal(previous.tag, '0042_team_biometric_time_zone')
  assert.equal(last?.idx, 43, 'PostgreSQL migration must append at index 43')
  assert.equal(last?.tag, '0043_group_session_vertical_prescription')
  assert.ok(last.when > previous.when, 'Canonical PostgreSQL timestamps must increase')

  const sqlPath = resolve(migrations, '0043_group_session_vertical_prescription.sql')
  const snapshotPath = resolve(migrations, 'meta/0043_snapshot.json')
  assert.ok(existsSync(sqlPath), 'Canonical PostgreSQL vertical migration SQL must exist')
  assert.ok(existsSync(snapshotPath), 'Canonical PostgreSQL 0043 snapshot must exist')

  const sql = readFileSync(sqlPath, 'utf8')
  for (const column of ['primary_objective', 'vertical_block_json']) {
    assert.match(
      sql,
      new RegExp('ALTER TABLE\\s+"group_session_prescriptions"\\s+ADD COLUMN\\s+"' + column + '"\\s+text\\s*;', 'i'),
      `Missing additive nullable PostgreSQL TEXT column ${column}`,
    )
  }
  assert.doesNotMatch(sql, /\\b(DROP|RENAME|TRUNCATE|UPDATE|DELETE)\\b/i, 'No destructive migration operations')

  const previousSnapshot = JSON.parse(readFileSync(resolve(migrations, 'meta/0042_snapshot.json'), 'utf8')) as {
    id: string
    tables: Record<string, { columns: Record<string, unknown>; indexes: Record<string, unknown> }>
  }
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
    prevId: string
    tables: Record<string, { columns: Record<string, { type: string; notNull: boolean }>; indexes: Record<string, unknown> }>
  }
  assert.equal(snapshot.prevId, previousSnapshot.id, '0043 must follow canonical 0042 snapshot')
  const before = previousSnapshot.tables['public.group_session_prescriptions'] ?? previousSnapshot.tables.group_session_prescriptions
  const after = snapshot.tables['public.group_session_prescriptions'] ?? snapshot.tables.group_session_prescriptions
  assert.ok(before && after, 'Group prescription table must remain in snapshot')
  for (const name of ['primary_objective', 'vertical_block_json']) {
    assert.equal(after.columns[name]?.type, 'text')
    assert.equal(after.columns[name]?.notNull, false)
  }
  for (const name of ['session_id', 'group_id', 'microcycle_id', 'elevation_gain']) {
    assert.deepEqual(after.columns[name], before.columns[name], `Preserve existing column ${name}`)
  }
  assert.deepEqual(after.indexes, before.indexes, 'Preserve Session + microcycle and generation key indexes')
})
