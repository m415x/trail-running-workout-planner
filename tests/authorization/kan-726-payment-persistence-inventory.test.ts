import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 classifies the complete H6 payment persistence call chain and current provenance gap', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const sink of [
    'billing-drizzle-database.ts',
    'billing-persistence.ts',
    'billing-sqlite-persistence.ts',
    'billing-drizzle-write-repository.ts',
    'billing-sqlite-transaction.ts',
    'payment_revisions',
    'no authorship column',
  ]) {
    assert.ok(inventory.includes(sink), 'Unclassified persistence contract: ' + sink)
  }
})
