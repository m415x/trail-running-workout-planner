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
