import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('Supabase verifier includes H3 Payment table and persistence contract checks', () => {
  const verify = fs.readFileSync(
    path.join(process.cwd(), 'db', 'supabase', 'verify.ts'),
    'utf8',
  )

  assert.match(verify, /['"]payment_revisions['"]/)
  assert.match(verify, /H3 billing persistence contract/)
  assert.match(verify, /payment_revisions_monthly_charge_idx/)
  assert.match(verify, /payment_revisions_payment_current_unique/)
  assert.match(verify, /payment_revisions_amount_positive_check/)
  assert.match(verify, /payment_revisions_method_check/)
})
