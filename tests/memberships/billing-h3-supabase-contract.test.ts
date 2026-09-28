import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'

test('Supabase H3 Payment schema and migration preserve SQLite contract parity and RLS', () => {
  const root = process.cwd()
  const schema = fs.readFileSync(path.join(root, 'db', 'supabase', 'schema.ts'), 'utf8')
  const journal = JSON.parse(
    fs.readFileSync(path.join(root, 'drizzle', 'supabase', 'meta', '_journal.json'), 'utf8'),
  ) as { entries: Array<{ tag: string }> }

  assert.match(schema, /paymentRevisions\s*=\s*pgTable\(\s*['"]payment_revisions['"]/)

  for (const column of [
    'payment_id',
    'monthly_charge_id',
    'amount_minor',
    'payment_method',
    'paid_at',
    'voided',
    'is_current',
  ]) {
    assert.match(schema, new RegExp(column))
  }

  assert.match(schema, /payment_revisions_amount_positive_check/)
  assert.match(schema, /payment_revisions_method_check/)
  assert.match(schema, /payment_revisions_monthly_charge_idx/)
  assert.match(schema, /payment_revisions_payment_current_unique/)

  const migration = journal.entries.find(entry => entry.tag.startsWith('0025_'))
  assert.ok(migration, 'missing generated Supabase H3 Payment migration after H2')

  const sql = fs.readFileSync(
    path.join(root, 'drizzle', 'supabase', migration.tag + '.sql'),
    'utf8',
  )

  assert.match(sql, /CREATE TABLE "payment_revisions"/)
  assert.match(sql, /REFERENCES "public"\."monthly_charges"\("id"\)/)
  assert.match(sql, /payment_revisions_amount_positive_check/)
  assert.match(sql, /payment_revisions_method_check/)
  assert.match(sql, /payment_revisions_monthly_charge_idx/)
  assert.match(sql, /payment_revisions_payment_current_unique/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /cash/)
  assert.match(sql, /bank_transfer/)
  assert.doesNotMatch(sql, /card|other|mercado[_ ]?pago/i)
})
