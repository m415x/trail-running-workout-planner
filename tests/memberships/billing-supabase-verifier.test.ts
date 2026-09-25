import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

const root = process.cwd()
const verifier = fs.readFileSync(path.join(root, 'db', 'supabase', 'verify.ts'), 'utf8')

test('Supabase verifier requires all H1 billing tables with RLS enabled', () => {
  for (const table of ['team_economic_policies', 'athlete_billing_terms', 'monthly_charges']) {
    assert.match(verifier, new RegExp(table))
  }
  assert.match(verifier, /relrowsecurity/)
  assert.match(verifier, /Tables with RLS/)
})

test('Supabase verifier checks H1 monthly charge uniqueness and billing terms FK', () => {
  assert.match(verifier, /monthly_charges_athlete_year_month_unique/)
  assert.match(verifier, /monthly_charges/)
  assert.match(verifier, /billing_terms_id/)
  assert.match(verifier, /athlete_billing_terms/)
  assert.match(verifier, /FOREIGN KEY|foreign key|constraint_type/i)
})

test('Supabase verifier fails when H1 billing invariants are missing', () => {
  assert.match(verifier, /billingContractValid/)
  assert.match(verifier, /process\.exitCode\s*=\s*1/)
})
