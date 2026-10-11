import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 inventory identifies concrete runtime sinks and residual legacy team context', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const sink of [
    'lib/memberships/billing-server-action-runtime.ts',
    'lib/memberships/membership-action-handlers.ts',
    'lib/athletes/group-assignment.ts',
    'CURRENT_TEAM_ID',
    'paymentRevisions',
    'groupHistoryRecords',
  ]) {
    assert.ok(inventory.includes(sink), 'T1 has not classified runtime sink: ' + sink)
  }
})
