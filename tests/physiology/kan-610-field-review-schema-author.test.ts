import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 field evidence review has nullable durable reviewer FK', () => {
  const schema = readFileSync('db/schema.ts', 'utf8')
  const start = schema.indexOf('export const fieldPerformanceTests = sqliteTable(')
  const end = schema.indexOf('\nexport const ', start + 1)
  assert.ok(start >= 0)
  const block = schema.slice(start, end < 0 ? undefined : end)
  assert.ok(block.includes("reviewedByUserId: text('reviewed_by_user_id').references(() => users.id, { onDelete: 'restrict' })"), 'reviewer identity must be durable, nullable for historical observations, and RESTRICT')
})
