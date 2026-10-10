import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 inventory classifies policy/terms and exception application writers separately', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  for (const name of [
    'lib/memberships/billing-coach-actions.ts',
    'configureTeamEconomicPolicyAction',
    'applyInitialAthleteBillingTermsAction',
    'changeAthleteBillingTermsAction',
    'applyGlobalDueDateExceptionAction',
    'applyMonthlyChargeReductionAction',
    'applyMonthlyChargeExtensionAction',
    'materializeTeamMonthlyChargesAction',
    'createSynchronousDrizzleBillingRepository',
    'T4',
    'T5',
  ]) {
    assert.ok(inventory.includes(name), 'H7A writer classification missing: ' + name)
  }
})
