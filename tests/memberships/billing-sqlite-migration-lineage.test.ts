import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('SQLite H3 migration bridges missing H1/H2 snapshots without recreating existing billing tables', () => {
  const root = process.cwd()
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }

  const migration = journal.entries.find(entry => entry.tag.startsWith('0012_'))
  assert.ok(migration, 'missing SQLite H3 migration after 0011')

  const sql = fs.readFileSync(
    path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'),
    'utf8',
  )

  assert.match(sql, /CREATE TABLE `payment_revisions`/)
  assert.match(sql, /payment_revisions_monthly_charge_idx/)
  assert.match(sql, /payment_revisions_payment_current_unique/)

  for (const existingTable of [
    'athlete_billing_terms',
    'team_economic_policies',
    'monthly_charges',
    'global_monthly_due_date_exceptions',
    'monthly_charge_reductions',
    'monthly_charge_extensions',
  ]) {
    assert.doesNotMatch(
      sql,
      new RegExp('CREATE TABLE `' + existingTable + '`'),
      `H3 migration must not recreate existing H1/H2 table ${existingTable}`,
    )
  }
})
