import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 payment replacement compare-and-swaps only the still-current revision', () => {
  const source = readFileSync('lib/memberships/billing-drizzle-database.ts', 'utf8')
  const start = source.indexOf('async replaceCurrentPaymentRevisionAtomically(')
  const end = source.indexOf('\n    async ', start + 1)
  assert.ok(start >= 0)
  const body = source.slice(start, end)
  assert.match(body, /eq\(paymentRevisions\.isCurrent, true\)/, 'transactional demotion must guard current status')
  assert.match(body, /affectedRows|changes|rowsAffected|returning\(/, 'transaction must detect stale updates before appending successor')
})
