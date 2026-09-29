import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()

test('Supabase versions prescription planning-scope uniqueness after 0025 and verifies the deployed index', () => {
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'supabase', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }
  const migration = journal.entries.find(entry => entry.tag.startsWith('0026_'))
  assert.ok(migration, 'missing versioned KAN-522 Supabase migration after 0025')

  const sql = fs.readFileSync(path.join(root, 'drizzle', 'supabase', migration.tag + '.sql'), 'utf8')
  assert.match(sql, /DROP INDEX\s+IF EXISTS\s+"group_session_prescriptions_session_group_unique"/i)
  assert.match(
    sql,
    /CREATE UNIQUE INDEX\s+"group_session_prescriptions_session_microcycle_unique"[\s\S]*\("session_id","microcycle_id"\)/i,
  )
  assert.doesNotMatch(sql, /INSERT INTO\s+"group_session_prescriptions"/i)
  assert.doesNotMatch(sql, /UPDATE\s+"group_session_prescriptions"/i)
  assert.doesNotMatch(sql, /DELETE FROM\s+"group_session_prescriptions"/i)

  const verify = fs.readFileSync(path.join(root, 'db', 'supabase', 'verify.ts'), 'utf8')
  assert.match(verify, /group_session_prescriptions_session_microcycle_unique/)
  assert.match(verify, /Prescription planning scope contract/)
})
