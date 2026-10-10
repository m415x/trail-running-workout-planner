import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment revision schema retains nullable H2 author with RESTRICT foreign key', () => {
  const source = readFileSync('db/schema.ts', 'utf8')
  const start = source.indexOf('export const paymentRevisions = sqliteTable(')
  assert.ok(start >= 0)
  const end = source.indexOf('\nexport const ', start + 1)
  const body = source.slice(start, end < 0 ? undefined : end)
  assert.ok(body.includes("createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'restrict' })"), 'payment revision must preserve verified user reference; historical author may remain NULL')
})
