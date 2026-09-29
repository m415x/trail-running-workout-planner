import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()

test('SQLite versions the prescription planning-scope uniqueness migration after 0012', () => {
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ idx: number; tag: string }> }

  const migration = journal.entries.find(entry => entry.tag.startsWith('0013_'))
  assert.ok(migration, 'missing versioned KAN-522 prescription planning-scope migration after 0012')

  const sql = fs.readFileSync(
    path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'),
    'utf8',
  )

  assert.match(sql, /DROP INDEX\s+[`"]group_session_prescriptions_session_group_unique[`"];/i)
  assert.match(
    sql,
    /CREATE UNIQUE INDEX\s+[`"]group_session_prescriptions_session_microcycle_unique[`\"][\s\S]*\([`\"]session_id[`\"],\s*[`\"]microcycle_id[`\"]\)/i,
  )
  assert.doesNotMatch(sql, /INSERT INTO\s+[`"]group_session_prescriptions[`"]+/i)
  assert.doesNotMatch(sql, /UPDATE\s+[`"]group_session_prescriptions[`"]+/i)
  assert.doesNotMatch(sql, /DELETE FROM\s+[`"]group_session_prescriptions[`"]+/i)
})
