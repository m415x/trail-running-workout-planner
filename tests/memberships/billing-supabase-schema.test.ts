import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const schema = fs.readFileSync(path.join(root, 'db', 'supabase', 'schema.ts'), 'utf8')

test('PostgreSQL H1 schema persists temporal team economic policies with minor-unit money', () => {
  assert.match(schema, /teamEconomicPolicies\s*=\s*pgTable\(\s*['"]team_economic_policies['"]/)
  assert.match(schema, /defaultMonthlyAmountMinor:\s*integer\(['"]default_monthly_amount_minor['"]\)\.notNull\(\)/)
  assert.match(schema, /ordinaryDueDay:\s*integer\(['"]ordinary_due_day['"]\)\.notNull\(\)/)
  assert.match(schema, /team_economic_policies_amount_positive_check/)
  assert.match(schema, /team_economic_policies_due_day_check/)
  assert.match(schema, /team_economic_policies_date_order_check/)
})

test('PostgreSQL H1 schema persists athlete billing terms independently from legacy memberships', () => {
  assert.match(schema, /athleteBillingTerms\s*=\s*pgTable\(\s*['"]athlete_billing_terms['"]/)
  assert.match(schema, /monthlyAmountMinor:\s*integer\(['"]monthly_amount_minor['"]\)\.notNull\(\)/)
  assert.match(schema, /athlete_billing_terms_amount_positive_check/)
  assert.match(schema, /athlete_billing_terms_date_order_check/)
  assert.match(schema, /memberships\s*=\s*pgTable\(['"]memberships['"]/)
})

test('PostgreSQL H1 monthly charges enforce one snapshot per athlete month and H2-compatible amounts', () => {
  assert.match(schema, /monthlyCharges\s*=\s*pgTable\(\s*['"]monthly_charges['"]/)
  for (const column of ['billing_terms_id', 'year', 'month', 'base_amount_minor', 'amount_due_minor', 'currency', 'base_due_date', 'effective_due_date']) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /monthly_charges_athlete_year_month_unique/)
  assert.match(schema, /monthly_charges_month_check/)
  assert.match(schema, /baseAmountMinor}\s*>\s*0[\s\S]*amountDueMinor}\s*>=\s*0/)
  assert.match(schema, /billingTermsId:[\s\S]*references\(\(\) => athleteBillingTerms\.id, \{ onDelete: ['"]restrict['"] \}\)/)
})


test('PostgreSQL H2 schema persists global monthly due-date exception revisions', () => {
  assert.match(schema, /globalMonthlyDueDateExceptions\s*=\s*pgTable\(\s*['"]global_monthly_due_date_exceptions['"]/)
  for (const column of ['team_id', 'year', 'month', 'due_date', 'reason', 'is_current']) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /global_monthly_due_date_exceptions_team_period_current_unique/)
})

test('PostgreSQL H2 schema persists monthly charge reduction revisions', () => {
  assert.match(schema, /monthlyChargeReductions\s*=\s*pgTable\(\s*['"]monthly_charge_reductions['"]/)
  for (const column of ['monthly_charge_id', 'reduction_amount_minor', 'reason', 'is_current']) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /monthly_charge_reductions_amount_check/)
  assert.match(schema, /monthly_charge_reductions_charge_current_unique/)
})

test('PostgreSQL H2 schema persists monthly charge extension revisions', () => {
  assert.match(schema, /monthlyChargeExtensions\s*=\s*pgTable\(\s*['"]monthly_charge_extensions['"]/)
  for (const column of ['monthly_charge_id', 'extended_due_date', 'reason', 'is_current']) {
    assert.match(schema, new RegExp(column))
  }
  assert.match(schema, /monthly_charge_extensions_charge_current_unique/)
})


test('PostgreSQL H2 migration materializes all three revision tables and partial current indexes', () => {
  const journal = fs.readFileSync(path.join(root, 'drizzle', 'supabase', 'meta', '_journal.json'), 'utf8')
  assert.match(journal, /0024_membership_billing_exceptions/)

  const migration = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', '0024_membership_billing_exceptions.sql'),
    'utf8',
  )
  for (const table of [
    'global_monthly_due_date_exceptions',
    'monthly_charge_reductions',
    'monthly_charge_extensions',
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`))
  }
  assert.match(migration, /global_monthly_due_date_exceptions_team_period_current_unique/)
  assert.match(migration, /monthly_charge_reductions_charge_current_unique/)
  assert.match(migration, /monthly_charge_extensions_charge_current_unique/)
  assert.match(migration, /WHERE "is_current" = true/)
})


test('Supabase verification includes H2 tables and validates their RLS plus persistence contract', () => {
  const verify = fs.readFileSync(path.join(root, 'db', 'supabase', 'verify.ts'), 'utf8')
  for (const table of [
    'global_monthly_due_date_exceptions',
    'monthly_charge_reductions',
    'monthly_charge_extensions',
  ]) {
    assert.match(verify, new RegExp(`['"]${table}['"]`))
  }
  assert.match(verify, /H2 billing persistence contract/)
  assert.match(verify, /global_monthly_due_date_exceptions_team_period_current_unique/)
  assert.match(verify, /monthly_charge_reductions_charge_current_unique/)
  assert.match(verify, /monthly_charge_extensions_charge_current_unique/)
})


test('Supabase H2 migration enables RLS on every economic fact table', () => {
  const migration = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', '0024_membership_billing_exceptions.sql'),
    'utf8',
  )
  for (const table of [
    'global_monthly_due_date_exceptions',
    'monthly_charge_reductions',
    'monthly_charge_extensions',
  ]) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`))
  }
})


test('Supabase H2 schema is consumable by the shared Drizzle billing adapter', () => {
  const adapter = fs.readFileSync(
    path.join(root, 'lib', 'memberships', 'billing-drizzle-database.ts'),
    'utf8',
  )
  assert.match(adapter, /from ['"]@\/db\/schema['"]/)
  assert.match(adapter, /globalMonthlyDueDateExceptions/)
  assert.match(adapter, /monthlyChargeReductions/)
  assert.match(adapter, /monthlyChargeExtensions/)

  const supabaseSchema = fs.readFileSync(path.join(root, 'db', 'supabase', 'schema.ts'), 'utf8')
  assert.match(supabaseSchema, /export const globalMonthlyDueDateExceptions/)
  assert.match(supabaseSchema, /export const monthlyChargeReductions/)
  assert.match(supabaseSchema, /export const monthlyChargeExtensions/)
})


test('Supabase H2 migration preserves SQLite-equivalent foreign-key and reduction constraints', () => {
  const migration = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', '0024_membership_billing_exceptions.sql'),
    'utf8',
  )
  assert.match(migration, /global_monthly_due_date_exceptions_month_check/)
  assert.match(migration, /"month" between 1 and 12/)
  assert.match(migration, /monthly_charge_reductions_amount_check/)
  assert.match(migration, /"reduction_amount_minor" >= 0/)
  assert.match(migration, /global_monthly_due_date_exceptions_team_id_teams_id_fk/)
  assert.match(migration, /ON DELETE cascade/i)
  assert.match(migration, /monthly_charge_reductions_monthly_charge_id_monthly_charges_id_fk/)
  assert.match(migration, /monthly_charge_extensions_monthly_charge_id_monthly_charges_id_fk/)
  assert.equal((migration.match(/ON DELETE restrict/gi) ?? []).length >= 2, true)
  assert.match(migration, /"extended_due_date" text,/)
})


test('Supabase verifier validates H2 foreign keys and reduction/month constraints, not only current indexes', () => {
  const verify = fs.readFileSync(path.join(root, 'db', 'supabase', 'verify.ts'), 'utf8')
  assert.match(verify, /global_monthly_due_date_exceptions_month_check/)
  assert.match(verify, /monthly_charge_reductions_amount_check/)
  assert.match(verify, /global_monthly_due_date_exceptions_team_id_teams_id_fk/)
  assert.match(verify, /monthly_charge_reductions_monthly_charge_id_monthly_charges_id_fk/)
  assert.match(verify, /monthly_charge_extensions_monthly_charge_id_monthly_charges_id_fk/)
})
