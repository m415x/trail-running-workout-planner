import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 each economic exception revision retains author identity or explicit unknown', () => {
  const source = readFileSync('lib/memberships/billing.ts', 'utf8')
  for (const name of ['GlobalDueDateExceptionRevision', 'MonthlyChargeReductionRevision', 'MonthlyChargeExtensionRevision']) {
    const start = source.indexOf('export type ' + name + ' = {')
    assert.ok(start >= 0, name)
    const declaration = source.slice(start, source.indexOf('}', start))
    assert.ok(declaration.includes('createdByUserId: string | null'), name + ' requires nullable durable author')
  }
})
