import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMembershipPageModel } from '../../lib/memberships/membership-page-model'

test('builds the membership page model from the current scoped team policy', async () => {
  const model = await buildMembershipPageModel({
    locale: 'es',
    teamId: 'team_1',
    onDate: '2026-10-15',
    repository: {
      listTeamEconomicPolicies: async (teamId) => {
        assert.equal(teamId, 'team_1')
        return [{
          id: 'policy-1',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-10-01',
          effectiveUntil: null,
        }]
      },
    },
  })

  assert.equal(model.title, 'Membresía')
  assert.equal(model.policyTitle, 'Política económica del equipo')
  assert.equal(model.monthlyAmount, '$25.000')
  assert.equal(model.currency, 'ARS')
  assert.equal(model.dueDay, '5')
  assert.equal(model.effectiveFrom, '2026-10-01')
})

test('builds the empty membership page model without causing materialization', async () => {
  let reads = 0

  const model = await buildMembershipPageModel({
    locale: 'en',
    teamId: 'team_1',
    onDate: '2026-10-15',
    repository: {
      listTeamEconomicPolicies: async () => {
        reads += 1
        return []
      },
    },
  })

  assert.equal(reads, 1)
  assert.equal(model.title, 'Membership')
  assert.equal(model.monthlyAmount, null)
  assert.equal(model.emptyState, 'No economic policy has been configured yet.')
})


test('builds policy presentation and prospective form model from the same policy read', async () => {
  let reads = 0

  const model = await buildMembershipPageModel({
    locale: 'es',
    teamId: 'team_1',
    onDate: '2026-10-15',
    repository: {
      listTeamEconomicPolicies: async () => {
        reads += 1
        return [{
          id: 'policy-1',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-10-01',
          effectiveUntil: null,
        }]
      },
    },
  })

  assert.equal(reads, 1)
  assert.equal(model.policy.monthlyAmount, '$25.000')
  assert.equal(model.form.mode, 'replacement')
  assert.equal(model.form.monthlyAmountMinor, 2_500_000)
  assert.equal(model.form.currency, 'ARS')
  assert.equal(model.form.ordinaryDueDay, 5)
})


test('shows the current policy and the next scheduled policy from one scoped read', async () => {
  let reads = 0

  const model = await buildMembershipPageModel({
    locale: 'es',
    teamId: 'team_1',
    onDate: '2026-09-25',
    repository: {
      listTeamEconomicPolicies: async () => {
        reads += 1
        return [
          {
            id: 'policy-current',
            teamId: 'team_1',
            defaultMonthlyAmountMinor: 2_500_000,
            currency: 'ARS',
            ordinaryDueDay: 5,
            effectiveFrom: '2026-09-01',
            effectiveUntil: '2026-10-01',
          },
          {
            id: 'policy-next',
            teamId: 'team_1',
            defaultMonthlyAmountMinor: 2_700_000,
            currency: 'ARS',
            ordinaryDueDay: 5,
            effectiveFrom: '2026-10-01',
            effectiveUntil: null,
          },
        ]
      },
    },
  })

  assert.equal(reads, 1)
  assert.equal(model.policy.monthlyAmount, '$25.000')
  assert.equal(model.policy.effectiveUntil, '2026-10-01')
  assert.equal(model.nextPolicy?.monthlyAmount, '$27.000')
  assert.equal(model.nextPolicy?.currency, 'ARS')
  assert.equal(model.nextPolicy?.dueDay, '5')
  assert.equal(model.nextPolicy?.effectiveFrom, '2026-10-01')
})


test('partitions past current and scheduled policies and bases the form on the latest scheduled policy', async () => {
  const model = await buildMembershipPageModel({
    locale: 'es',
    teamId: 'team_1',
    onDate: '2026-09-25',
    repository: {
      listTeamEconomicPolicies: async () => [
        {
          id: 'policy-past',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 2_000_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-08-01',
          effectiveUntil: '2026-09-01',
        },
        {
          id: 'policy-current',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-09-01',
          effectiveUntil: '2026-10-01',
        },
        {
          id: 'policy-next',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 2_700_000,
          currency: 'ARS',
          ordinaryDueDay: 5,
          effectiveFrom: '2026-10-01',
          effectiveUntil: '2026-11-01',
        },
        {
          id: 'policy-later',
          teamId: 'team_1',
          defaultMonthlyAmountMinor: 3_000_000,
          currency: 'ARS',
          ordinaryDueDay: 10,
          effectiveFrom: '2026-11-01',
          effectiveUntil: null,
        },
      ],
    },
  })

  assert.equal(model.currentPolicy.monthlyAmount, '$25.000')
  assert.deepEqual(
    model.scheduledPolicies.map((policy) => policy.monthlyAmount),
    ['$27.000', '$30.000'],
  )
  assert.deepEqual(
    model.pastPolicies.map((policy) => policy.monthlyAmount),
    ['$20.000'],
  )
  assert.equal(model.form.monthlyAmountMinor, 3_000_000)
  assert.equal(model.form.ordinaryDueDay, 10)
})
