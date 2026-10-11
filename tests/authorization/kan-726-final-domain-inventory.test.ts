import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 final inventory closes organization and 1000 m repository sinks with explicit scope', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const required of [
    'lib/physiology/field-performance-test-sqlite.ts',
    'createSqliteFieldPerformanceTestRepository',
    'fieldPerformanceTests',
    'correction transaction',
    'review update',
    'teamMemberships',
    'authorizationGrants',
    'no deployed grant mutation writer',
    'planningCohortMemberships',
    'groupHistoryRecords',
    'T3',
    'T7',
  ]) {
    assert.ok(inventory.includes(required), 'unclassified organizational or sporting sink: ' + required)
  }
})
