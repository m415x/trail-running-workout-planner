import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configureTeamEconomicPolicyAction,
  applyInitialAthleteBillingTermsAction,
  changeAthleteBillingTermsAction,
  type BillingCoachActionDependencies,
} from '../../lib/memberships/billing-coach-actions'

test('Coach action validates input before opening a transaction', async () => {
  let transactions = 0
  const dependencies: BillingCoachActionDependencies = {
    transaction: () => {
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
    transaction: (operation) => {
      calls.push('transaction:start')
      const result = operation({
        listTeamEconomicPolicies: (teamId) => {
          calls.push(`list:${teamId}`)
          return []
        },
        saveTeamEconomicPolicy: (policy) => {
          calls.push(`save:${policy.id}`)
        },
        replaceTeamEconomicPolicy: () => {
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
    transaction: () => {
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


test('Coach action applies initial athlete billing terms inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'terms-a',
    transaction: (operation) => {
      calls.push('transaction:start')
      const result = operation({
        athleteBelongsToTeam: (teamId, athleteId) => {
          calls.push(`belongs:${teamId}:${athleteId}`)
          return true
        },
        listTeamEconomicPolicies: () => [{
          id: 'policy-a',
          teamId: 'team-a',
          defaultMonthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-10-01',
          effectiveUntil: null,
        }],
        listAthleteBillingTerms: () => [],
        saveAthleteBillingTerms: (terms) => {
          calls.push(`save:${terms.id}`)
        },
        replaceAthleteBillingTerms: () => {
          throw new Error('unexpected replacement')
        },
      })
      calls.push('transaction:end')
      return result
    },
  }

  const result = await applyInitialAthleteBillingTermsAction({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-10-18',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [
    'transaction:start',
    'belongs:team-a:athlete-a',
    'save:terms-a',
    'transaction:end',
  ])
})

test('Coach action changes athlete billing terms inside one transaction', async () => {
  const calls: string[] = []
  const dependencies: BillingCoachActionDependencies = {
    createId: () => 'terms-b',
    transaction: (operation) => {
      const result = operation({
        athleteBelongsToTeam: () => true,
        listTeamEconomicPolicies: () => [],
        listAthleteBillingTerms: () => [{
          id: 'terms-a',
          athleteId: 'athlete-a',
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-10-18',
          effectiveUntil: null,
        }],
        saveAthleteBillingTerms: () => {},
        replaceAthleteBillingTerms: (current, replacement) => {
          calls.push(`${current.effectiveUntil}:${replacement.monthlyAmountMinor}`)
        },
      })
      return result
    },
  }

  const result = await changeAthleteBillingTermsAction({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  }, dependencies)

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, ['2026-11-01:3000000'])
})
