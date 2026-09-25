import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('canonical SQLite HEAD verifier requires the H1 billing tables and physical invariants', () => {
  const verifier = fs.readFileSync(path.join(process.cwd(), 'scripts', 'verify-sqlite.ts'), 'utf8')

  for (const table of ['team_economic_policies', 'athlete_billing_terms', 'monthly_charges']) {
    assert.match(verifier, new RegExp(table))
  }

  assert.match(verifier, /index_list\(monthly_charges\)/)
  assert.match(verifier, /monthly_charges_athlete_year_month_unique/)
  assert.match(verifier, /foreign_key_list\(monthly_charges\)/)
  assert.match(verifier, /billing_terms_id/)
  assert.match(verifier, /athlete_billing_terms/)
  assert.match(verifier, /foreign_key_check/)
})
