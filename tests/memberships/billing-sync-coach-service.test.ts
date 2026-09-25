import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSynchronousBillingCoachService,
  type SynchronousBillingCoachRepository,
} from '../../lib/memberships/billing-coach-service'

test('synchronous Coach service configures policy without Promise-based repository methods', () => {
  const saved: string[] = []
  const repository: SynchronousBillingCoachRepository = {
    listTeamEconomicPolicies: () => [],
    saveTeamEconomicPolicy: (policy) => {
      saved.push(policy.id)
    },
    replaceTeamEconomicPolicy: () => {
      throw new Error('unexpected replacement')
    },
  }

  const service = createSynchronousBillingCoachService(repository)
  const policy = service.configureTeamEconomicPolicy({
    teamId: 'team-a',
    policyId: 'policy-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })

  assert.equal(policy.id, 'policy-a')
  assert.deepEqual(saved, ['policy-a'])
})
