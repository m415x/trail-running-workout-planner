import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-731 Drizzle payment inserts and mapper preserve revision author', () => {
  const source = readFileSync('lib/memberships/billing-drizzle-database.ts', 'utf8')
  for (const [action, field] of [
    ['async insertPaymentRevision(', 'revision.createdByUserId'],
    ['async replaceCurrentPaymentRevisionAtomically(', 'replacement.createdByUserId'],
  ]) {
    const a = source.indexOf(action)
    assert.ok(a >= 0, action)
    const b = source.indexOf('\n    async ', a + 1)
    const block = source.slice(a, b < 0 ? undefined : b)
    assert.ok(block.includes('createdByUserId: ' + field), action + ' must write verified author')
  }
  const mapper = source.slice(source.indexOf('function mapPaymentRevision('), source.indexOf('function mapGlobalDueDateException('))
  assert.ok(mapper.includes('createdByUserId: row.createdByUserId == null ? null : String(row.createdByUserId)'), 'mapper must read historical nullable author')
})
