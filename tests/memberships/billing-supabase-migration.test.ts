import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const journalPath = path.join(root, 'drizzle', 'supabase', 'meta', '_journal.json')

test('PostgreSQL H1 billing contract has a versioned migration after the current 0022 head', () => {
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>
  }
  const migration = journal.entries.find((entry) => entry.idx > 22)
  assert.ok(migration, 'missing versioned PostgreSQL H1 billing migration after 0022')

  const sql = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', migration.tag + '.sql'),
    'utf8',
  )

  assert.match(sql, /CREATE TABLE ["']team_economic_policies["']/i)
  assert.match(sql, /CREATE TABLE ["']athlete_billing_terms["']/i)
  assert.match(sql, /CREATE TABLE ["']monthly_charges["']/i)
  assert.match(sql, /monthly_charges_athlete_year_month_unique/)
  assert.match(sql, /amount_due_minor[^;]*>=\s*0/i)
  assert.match(sql, /billing_terms_id[\s\S]*athlete_billing_terms/i)
  assert.doesNotMatch(
    sql,
    /INSERT INTO ["']athlete_billing_terms["'][\s\S]*SELECT[\s\S]*FROM ["']memberships["']|INSERT INTO ["']monthly_charges["'][\s\S]*SELECT[\s\S]*FROM ["']memberships["']|DROP TABLE ["']memberships["']/i,
  )
})
