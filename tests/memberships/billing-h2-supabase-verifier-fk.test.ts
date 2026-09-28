import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('Supabase H2 verifier does not depend on PostgreSQL-truncated FK names', () => {
  const verify = fs.readFileSync(
    path.join(process.cwd(), 'db', 'supabase', 'verify.ts'),
    'utf8',
  )

  assert.doesNotMatch(
    verify,
    /monthly_charge_reductions_monthly_charge_id_monthly_charges_id_fk/,
  )
  assert.doesNotMatch(
    verify,
    /monthly_charge_extensions_monthly_charge_id_monthly_charges_id_fk/,
  )

  assert.match(verify, /monthly_charge_reductions/)
  assert.match(verify, /monthly_charge_extensions/)
  assert.match(verify, /monthly_charge_id/)
  assert.match(verify, /monthly_charges/)
})
