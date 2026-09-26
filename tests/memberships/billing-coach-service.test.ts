import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBillingCoachService,
  type BillingCoachRepository,
} from '../../lib/memberships/billing-coach-service'

test('Coach billing service bootstraps the first team policy prospectively', async () => {
  const saved: string[] = []
  const repository: BillingCoachRepository = {
    listTeamEconomicPolicies: async () => [],
    saveTeamEconomicPolicy: async (policy) => {
      saved.push(`${policy.teamId}:${policy.effectiveFrom}:${policy.defaultMonthlyAmountMinor}`)
    },
    replaceTeamEconomicPolicy: async () => {
      throw new Error('unexpected replacement')
    },
  }

  const service = createBillingCoachService(repository)
  const policy = await service.configureTeamEconomicPolicy({
    teamId: 'team-a',
    policyId: 'policy-a',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })

  assert.equal(policy.effectiveUntil, null)
  assert.deepEqual(saved, ['team-a:2026-10-01:2500000'])
})

test('Coach billing service replaces current policy without rewriting historical policy', async () => {
  const current = {
    id: 'policy-a',
    teamId: 'team-a',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }
  const writes: string[] = []
  const repository: BillingCoachRepository = {
    listTeamEconomicPolicies: async () => [current],
    saveTeamEconomicPolicy: async () => {
      throw new Error('unexpected bootstrap')
    },
    replaceTeamEconomicPolicy: async (closed, replacement) => {
      writes.push(`close:${closed.id}:${closed.effectiveUntil}`)
      writes.push(`create:${replacement.id}:${replacement.effectiveFrom}`)
    },
  }

  const service = createBillingCoachService(repository)
  const policy = await service.configureTeamEconomicPolicy({
    teamId: 'team-a',
    policyId: 'policy-b',
    effectiveFrom: '2026-11-01',
    defaultMonthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })

  assert.equal(policy.id, 'policy-b')
  assert.deepEqual(writes, [
    'close:policy-a:2026-11-01',
    'create:policy-b:2026-11-01',
  ])
})

test('Coach billing service rejects ambiguous active team policy history', async () => {
  const repository: BillingCoachRepository = {
    listTeamEconomicPolicies: async () => [
      {
        id: 'policy-a',
        teamId: 'team-a',
        defaultMonthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
        effectiveFrom: '2026-10-01',
        effectiveUntil: null,
      },
      {
        id: 'policy-b',
        teamId: 'team-a',
        defaultMonthlyAmountMinor: 3_000_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
        effectiveFrom: '2026-11-01',
        effectiveUntil: null,
      },
    ],
    saveTeamEconomicPolicy: async () => {},
    replaceTeamEconomicPolicy: async () => {},
  }

  const service = createBillingCoachService(repository)

  await assert.rejects(
    () => service.configureTeamEconomicPolicy({
      teamId: 'team-a',
      policyId: 'policy-c',
      effectiveFrom: '2026-12-01',
      defaultMonthlyAmountMinor: 3_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
    }),
    /policy.*ambiguous/i,
  )
})
