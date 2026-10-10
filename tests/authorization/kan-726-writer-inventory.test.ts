import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const inventoryPath = 'docs/architecture/h7a-sensitive-writer-inventory.md'

test('KAN-726 requires a durable, domain-classified inventory before T2', () => {
  const inventory = readFileSync(inventoryPath, 'utf8')
  for (const domain of ['Identity and membership', 'Delegated grants', 'Groups and cohorts', 'Economic policy and terms', 'Economic exceptions', 'Payment revisions', 'Sporting 1000 m evidence']) {
    assert.ok(inventory.includes(domain), 'missing sensitive writer domain: ' + domain)
  }
  for (const writer of [
    'app/actions/athlete-actions.ts',
    'app/actions/group-actions.ts',
    'app/actions/planning-cohort-actions.ts',
    'app/actions/membership-actions.ts',
    'lib/memberships/h6-policy-action.ts',
    'lib/memberships/h6-terms-materialization-actions.ts',
    'lib/memberships/h6-economic-exception-actions.ts',
    'lib/memberships/h6-payment-actions.ts',
    'app/actions/field-performance-test-actions.ts',
    'lib/physiology/field-performance-test-application.ts',
  ]) {
    assert.ok(inventory.includes(writer), 'missing writer path: ' + writer)
  }
  for (const invariant of ['authenticatedActorUserId', 'effectiveActorUserId', 'append-only', 'DENY', 'legacy', 'T2']) {
    assert.ok(inventory.includes(invariant), 'missing inventory invariant: ' + invariant)
  }
})
