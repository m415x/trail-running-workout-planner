import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 athlete terms history declares nullable factual H2 creator in both database schemas', () => {
  for (const path of ['db/schema.ts', 'db/supabase/schema.ts']) {
    const source = readFileSync(path, 'utf8')
    const start = source.indexOf('export const athleteBillingTerms = ')
    const end = source.indexOf('export const monthlyCharges = ', start)
    assert.ok(start >= 0 && end > start, path + ' terms table must exist')
    const table = source.slice(start, end)
    assert.match(table, /createdByUserId:\s*text\('created_by_user_id'\)/, path + ' must retain original terms creator')
    assert.match(table, /references\(\(\) => users\.id,\s*\{ onDelete: 'restrict' \}\)/)
  }
})
