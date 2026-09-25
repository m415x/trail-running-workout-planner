import assert from 'node:assert/strict'
import test from 'node:test'

import { teamEconomicPolicies } from '../../db/schema'
import { createTeamEconomicPolicyQueryRepository } from '../../lib/memberships/membership-policy-drizzle-query'

test('reads team economic policies through the requested team scope', async () => {
  const calls: string[] = []
  const db = {
    select() {
      return {
        from(table: unknown) {
          assert.equal(table, teamEconomicPolicies)
          return {
            where() {
              calls.push('where')
              return {
                all() {
                  return [{
                    id: 'policy-1',
                    teamId: 'team_1',
                    defaultMonthlyAmountMinor: 2_500_000,
                    currency: 'ARS',
                    ordinaryDueDay: 5,
                    effectiveFrom: '2026-10-01',
                    effectiveUntil: null,
                    isDeleted: false,
                  }]
                },
              }
            },
          }
        },
      }
    },
  }

  const repository = createTeamEconomicPolicyQueryRepository(db)
  const policies = await repository.listTeamEconomicPolicies('team_1')

  assert.deepEqual(calls, ['where'])
  assert.deepEqual(policies, [{
    id: 'policy-1',
    teamId: 'team_1',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }])
})
