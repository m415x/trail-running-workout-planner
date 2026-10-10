import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 Drizzle reduction and extension inserts retain verified author', () => {
  const source = readFileSync('lib/memberships/billing-drizzle-database.ts', 'utf8')
  for (const [action, table] of [
    ['replaceCurrentMonthlyChargeReduction', 'monthlyChargeReductions'],
    ['replaceCurrentMonthlyChargeExtension', 'monthlyChargeExtensions'],
  ]) {
    const start = source.indexOf(action + '(')
    assert.ok(start >= 0, action)
    const next = source.indexOf('replaceCurrent', start + 1)
    const body = source.slice(start, next < 0 ? undefined : next)
    const insert = body.indexOf('tx.insert(' + table + ').values([{')
    assert.ok(insert >= 0, table + ' insertion must exist')
    const values = body.slice(insert, body.indexOf('}]))', insert))
    assert.ok(values.includes('createdByUserId: revision.createdByUserId'), table + ' must persist author')
  }
})
