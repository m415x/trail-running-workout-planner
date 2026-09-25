import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configureTeamEconomicPolicyAction,
  type BillingCoachActionDependencies,
} from '../../lib/memberships/billing-coach-actions'

test('Coach action validates input before opening a transaction', async () => {
  let transactions = 0
  const dependencies: BillingCoachActionDependencies = {
    transaction: async () => {
      transactions += 1
      throw new Error('transaction must not run')
    },
    createId: () => 'policy-a',
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-15',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.equal(result.success, false)
  assert.equal(transactions, 0)
})

test('Coach action performs policy configuration inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'policy-b',
    transaction: async (operation) => {
      calls.push('transaction:start')
      const result = await operation({
        listTeamEconomicPolicies: async (teamId) => {
          calls.push(`list:${teamId}`)
          return []
        },
        saveTeamEconomicPolicy: async (policy) => {
          calls.push(`save:${policy.id}`)
        },
        replaceTeamEconomicPolicy: async () => {
          throw new Error('unexpected replacement')
        },
      })
      calls.push('transaction:end')
      return result
    },
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'transaction:start',
    'list:team-a',
    'save:policy-b',
    'transaction:end',
  ])
})

test('Coach action returns a safe failure when transactional configuration fails', async () => {
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'policy-a',
    transaction: async () => {
      throw new Error('database detail')
    },
  }

  const result = await configureTeamEconomicPolicyAction({
    teamId: 'team-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  }, dependencies)

  assert.deepEqual(result, {
    success: false,
    error: 'Could not configure team economic policy',
  })
})
