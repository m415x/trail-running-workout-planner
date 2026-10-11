import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy history declares durable factual creation authorship', () => {
  const schema = readFileSync('db/schema.ts', 'utf8')
  const start = schema.indexOf('export const teamEconomicPolicies = sqliteTable(')
  const end = schema.indexOf('export const athleteBillingTerms = sqliteTable(', start)
  assert.ok(start >= 0 && end > start, 'policy and terms schema sections must exist')
  const policy = schema.slice(start, end)
  assert.match(policy, /createdByUserId:\s*text\('created_by_user_id'\)/, 'policy replacement must record its factual H2 creator')
  assert.match(policy, /references\(\(\) => users\.id,\s*\{ onDelete: 'restrict' \}\)/)
})
