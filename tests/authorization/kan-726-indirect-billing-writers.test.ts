import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 classifies indirect transactional billing writers', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const file of [
    'lib/memberships/billing-sqlite-coach-actions.ts',
    'lib/memberships/athlete-billing-terms-service.ts',
    'lib/memberships/billing-coach-service.ts',
  ]) {
    assert.ok(inventory.includes(file), 'Unclassified indirect billing writer: ' + file)
  }
  for (const entrypoint of [
    'configureTeamEconomicPolicySynchronously',
    'applyInitialAthleteBillingTermsSynchronously',
    'changeAthleteBillingTermsSynchronously',
  ]) {
    assert.ok(inventory.includes(entrypoint), 'Missing synchronous billing mutation: ' + entrypoint)
  }
})
