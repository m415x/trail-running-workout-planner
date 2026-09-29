import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const sqliteSchema = fs.readFileSync(path.join(root, 'db', 'schema.ts'), 'utf8')
const supabaseSchema = fs.readFileSync(path.join(root, 'db', 'supabase', 'schema.ts'), 'utf8')

test('SQLite prescription uniqueness is Session + microcycle planning scope, not Session + group', () => {
  assert.match(
    sqliteSchema,
    /group_session_prescriptions_session_microcycle_unique['"]\)\.on\(table\.sessionId, table\.microcycleId\)/,
  )
  assert.doesNotMatch(
    sqliteSchema,
    /group_session_prescriptions_session_group_unique['"]\)\.on\(table\.sessionId, table\.groupId\)/,
  )
})

test('Supabase prescription uniqueness matches SQLite planning-scope identity', () => {
  assert.match(
    supabaseSchema,
    /group_session_prescriptions_session_microcycle_unique['"]\)\.on\(table\.sessionId, table\.microcycleId\)/,
  )
  assert.doesNotMatch(
    supabaseSchema,
    /group_session_prescriptions_session_group_unique['"]\)\.on\(table\.sessionId, table\.groupId\)/,
  )
})
