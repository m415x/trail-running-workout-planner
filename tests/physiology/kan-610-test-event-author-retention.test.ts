import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-732 TestEvent author reference must preserve identity on user deletion', () => {
  const schema = readFileSync('db/schema.ts', 'utf8')
  const start = schema.indexOf('export const fieldPerformanceTestEvents = sqliteTable(')
  const end = schema.indexOf('export const fieldPerformanceTests = sqliteTable(', start)
  assert.ok(start >= 0 && end > start)
  const events = schema.slice(start, end)
  assert.ok(events.includes("createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'restrict' })"))
})
