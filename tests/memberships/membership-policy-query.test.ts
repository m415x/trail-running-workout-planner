import assert from 'node:assert/strict'
import test from 'node:test'

import { getCurrentTeamEconomicPolicy } from '../../lib/memberships/membership-policy-query'

test('returns the policy effective on the requested date', async () => {
  const policies = [
    {
      id: 'policy-old',
      teamId: 'team_1',
      defaultMonthlyAmountMinor: 2_000_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-01-01',
      effectiveUntil: '2026-10-01',
    },
    {
      id: 'policy-current',
      teamId: 'team_1',
      defaultMonthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-10-01',
      effectiveUntil: null,
    },
  ]

  const result = await getCurrentTeamEconomicPolicy({
    teamId: 'team_1',
    onDate: '2026-10-15',
    repository: {
      listGlobalDueDateExceptionRevisions: async () => [],
        listTeamEconomicPolicies: async (teamId) => {
        assert.equal(teamId, 'team_1')
        return policies
      },
    },
  })

  assert.equal(result?.id, 'policy-current')
})

test('returns null when the team has no policy effective on the requested date', async () => {
  const result = await getCurrentTeamEconomicPolicy({
    teamId: 'team_1',
    onDate: '2026-09-15',
    repository: {
      listGlobalDueDateExceptionRevisions: async () => [],
        listTeamEconomicPolicies: async () => [{
        id: 'policy-future',
        teamId: 'team_1',
        defaultMonthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
        effectiveFrom: '2026-10-01',
        effectiveUntil: null,
      }],
    },
  })

  assert.equal(result, null)
})

test('rejects ambiguous effective policies instead of choosing one heuristically', async () => {
  await assert.rejects(
    getCurrentTeamEconomicPolicy({
      teamId: 'team_1',
      onDate: '2026-10-15',
      repository: {
      listGlobalDueDateExceptionRevisions: async () => [],
      listTeamEconomicPolicies: async () => [
          {
            id: 'policy-a',
            teamId: 'team_1',
            defaultMonthlyAmountMinor: 2_500_000,
            currency: 'ARS',
            ordinaryDueDay: 5,
            effectiveFrom: '2026-10-01',
            effectiveUntil: null,
          },
          {
            id: 'policy-b',
            teamId: 'team_1',
            defaultMonthlyAmountMinor: 3_000_000,
            currency: 'ARS',
            ordinaryDueDay: 10,
            effectiveFrom: '2026-10-01',
            effectiveUntil: null,
          },
        ],
      },
    }),
    /ambiguous/i,
  )
})
