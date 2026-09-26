import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const schema = fs.readFileSync(path.join(root, 'db', 'schema.ts'), 'utf8')

test('SQLite H1 schema persists temporal team economic policies with minor-unit money', () => {
  assert.match(schema, /teamEconomicPolicies\s*=\s*sqliteTable\(\s*['"]team_economic_policies['"]/) 
  assert.match(schema, /defaultMonthlyAmountMinor:\s*integer\(['"]default_monthly_amount_minor['"]\)\.notNull\(\)/)
  assert.match(schema, /ordinaryDueDay:\s*integer\(['"]ordinary_due_day['"]\)\.notNull\(\)/)
  assert.match(schema, /team_economic_policies_amount_positive_check/)
  assert.match(schema, /team_economic_policies_due_day_check/)
  assert.match(schema, /team_economic_policies_date_order_check/)
})

test('SQLite H1 schema persists athlete billing terms as independent economic snapshots', () => {
  assert.match(schema, /athleteBillingTerms\s*=\s*sqliteTable\(\s*['"]athlete_billing_terms['"]/) 
  assert.match(schema, /monthlyAmountMinor:\s*integer\(['"]monthly_amount_minor['"]\)\.notNull\(\)/)
  assert.match(schema, /athlete_billing_terms_amount_positive_check/)
  assert.match(schema, /athlete_billing_terms_date_order_check/)
})

test('SQLite H1 monthly charges enforce one logical snapshot per athlete month', () => {
  assert.match(schema, /monthlyCharges\s*=\s*sqliteTable\(\s*['"]monthly_charges['"]/) 
  for (const column of ['billing_terms_id','year','month','base_amount_minor','amount_due_minor','currency','base_due_date','effective_due_date']) assert.match(schema, new RegExp(column))
  assert.match(schema, /monthly_charges_athlete_year_month_unique/)
  assert.match(schema, /monthly_charges_month_check/)
  assert.match(schema, /monthly_charges_amount_positive_check/)
})

test('SQLite H1 migration is versioned after 0007 and preserves legacy memberships without heuristic conversion', () => {
  const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
  const migration = journal.entries.find((entry) => entry.tag.startsWith('0008_'))
  assert.ok(migration, 'missing versioned SQLite H1 memberships migration after 0007')
  const sql = fs.readFileSync(path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'), 'utf8')
  assert.match(sql, /team_economic_policies/)
  assert.match(sql, /athlete_billing_terms/)
  assert.match(sql, /monthly_charges/)
  assert.doesNotMatch(sql, /INSERT INTO [`"]athlete_billing_terms[`\"][\s\S]*SELECT[\s\S]*FROM [`"]memberships[`"]|INSERT INTO [`"]monthly_charges[`\"][\s\S]*SELECT[\s\S]*FROM [`"]memberships[`"]|DROP TABLE [`"]memberships[`"]|DROP TABLE memberships/i)
})


test('SQLite H2 persists append-only global monthly due-date exception revisions', () => {
  assert.match(schema, /globalMonthlyDueDateExceptions\s*=\s*sqliteTable\(\s*['"]global_monthly_due_date_exceptions['"]/)
  for (const column of ['team_id', 'year', 'month', 'due_date', 'reason', 'is_current']) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /global_monthly_due_date_exceptions_month_check/)
  assert.match(schema, /global_monthly_due_date_exceptions_team_period_current_unique/)
})

test('SQLite H2 global due-date exception migration follows the H1 billing migration', () => {
  const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8')) as { entries: Array<{ tag: string }> }
  const migration = journal.entries.find((entry) => entry.tag.startsWith('0009_'))
  assert.ok(migration, 'missing versioned SQLite H2 global due-date exception migration after 0008')
  const sql = fs.readFileSync(path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'), 'utf8')
  assert.match(sql, /global_monthly_due_date_exceptions/)
  assert.match(sql, /team_id/)
  assert.match(sql, /due_date/)
  assert.match(sql, /reason/)
  assert.match(sql, /is_current/)
})


test('SQLite schema defines append-only monthly charge reduction revisions', () => {
  const schema = fs.readFileSync(path.join(root, 'db', 'schema.ts'), 'utf8')

  assert.match(schema, /monthlyChargeReductions\s*=\s*sqliteTable\(\s*['"]monthly_charge_reductions['"]/)
  assert.match(schema, /monthly_charge_id/)
  assert.match(schema, /reduction_amount_minor/)
  assert.match(schema, /reason/)
  assert.match(schema, /is_current/)
  assert.match(schema, /monthly_charge_reductions_amount_check/)
  assert.match(schema, /monthly_charge_reductions_charge_current_unique/)
})

test('SQLite migrations version monthly charge reductions after the global due-date exception slice', () => {
  const journal = JSON.parse(fs.readFileSync(path.join(root, 'drizzle', 'sqlite', 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>
  }
  const migration = journal.entries.find(entry => entry.tag.startsWith('0010_'))

  assert.ok(migration)
  assert.equal(migration.tag, '0010_membership_monthly_charge_reductions')

  const sql = fs.readFileSync(path.join(root, 'drizzle', 'sqlite', migration.tag + '.sql'), 'utf8')
  assert.match(sql, /CREATE TABLE [^\n]*monthly_charge_reductions/)
  assert.match(sql, /monthly_charge_id/)
  assert.match(sql, /reduction_amount_minor/)
  assert.match(sql, /reason/)
  assert.match(sql, /is_current/)
})
