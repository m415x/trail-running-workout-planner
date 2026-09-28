import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('Supabase H3 migration contains only the Payment delta after H1/H2', () => {
  const root = process.cwd()
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'supabase', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }

  const migration = journal.entries.find(entry => entry.tag.startsWith('0025_'))
  assert.ok(migration, 'missing generated Supabase H3 migration')

  const sql = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', migration.tag + '.sql'),
    'utf8',
  )

  assert.match(sql, /CREATE TABLE "payment_revisions"/)

  for (const table of [
    'team_economic_policies',
    'athlete_billing_terms',
    'monthly_charges',
    'global_monthly_due_date_exceptions',
    'monthly_charge_reductions',
    'monthly_charge_extensions',
  ]) {
    assert.doesNotMatch(
      sql,
      new RegExp(`CREATE TABLE "${table}"`),
      `H3 migration must not recreate ${table}`,
    )
  }

  assert.match(
    sql,
    /ALTER TABLE "payment_revisions" ENABLE ROW LEVEL SECURITY/,
    'H3 Payment table must enable RLS',
  )

  const statements = sql
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())

  assert.ok(
    statements.every(statement => statement.length > 0),
    'Supabase H3 migration must not contain empty SQL statements',
  )
})
