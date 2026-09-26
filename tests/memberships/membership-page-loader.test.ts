import assert from 'node:assert/strict'
import test from 'node:test'

import { createMembershipPageLoader } from '../../lib/memberships/membership-page-loader'

test('loads the Coach membership page through the scoped repository and requested date', async () => {
  const calls: string[] = []

  const loadPage = createMembershipPageLoader({
    createRepository: (db) => {
      assert.equal(db, 'db-client')
      return {
      listGlobalDueDateExceptionRevisions: async () => [],
      listTeamEconomicPolicies: async (teamId: string) => {
          calls.push(`team:${teamId}`)
          return [{
            id: 'policy-1',
            teamId,
            defaultMonthlyAmountMinor: 2_500_000,
            currency: 'ARS',
            ordinaryDueDay: 5,
            effectiveFrom: '2026-10-01',
            effectiveUntil: null,
          }]
        },
      }
    },
  })

  const model = await loadPage({
    db: 'db-client',
    locale: 'es',
    teamId: 'team_1',
    onDate: '2026-10-15',
  })

  assert.deepEqual(calls, ['team:team_1'])
  assert.equal(model.title, 'Membresía')
  assert.equal(model.monthlyAmount, '$25.000')
})

test('membership page loading remains read-only', async () => {
  const repository = {
    listGlobalDueDateExceptionRevisions: async () => [],
        listTeamEconomicPolicies: async () => [],
  }

  const loadPage = createMembershipPageLoader({
    createRepository: () => repository,
  })

  const model = await loadPage({
    db: 'db-client',
    locale: 'en',
    teamId: 'team_1',
    onDate: '2026-10-15',
  })

  assert.equal(model.title, 'Membership')
  assert.equal(model.monthlyAmount, null)
  assert.deepEqual(Object.keys(repository).sort(), ['listGlobalDueDateExceptionRevisions', 'listTeamEconomicPolicies'])
})
