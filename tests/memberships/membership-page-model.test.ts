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
