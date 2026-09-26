import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSynchronousDrizzleBillingRepository,
} from '../../lib/memberships/billing-drizzle-write-repository'

test('synchronous Drizzle billing repository persists policy replacement with run()', () => {
  const calls: string[] = []
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => [{
            id: 'policy-a',
            teamId: 'team-a',
            defaultMonthlyAmountMinor: 2_500_000,
            currency: 'ARS',
            ordinaryDueDay: 5,
            effectiveFrom: '2026-10-01',
            effectiveUntil: null,
          }],
        }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        run: () => calls.push(`insert:${String(value.id)}`),
      }),
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          run: () => calls.push(`update:${String(value.effectiveUntil)}`),
        }),
      }),
    }),
  }

  const repository = createSynchronousDrizzleBillingRepository(db)
  const policies = repository.listTeamEconomicPolicies('team-a')

  repository.replaceTeamEconomicPolicy(
    { ...policies[0]!, effectiveUntil: '2026-11-01' },
    {
      id: 'policy-b',
      teamId: 'team-a',
      defaultMonthlyAmountMinor: 3_000_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-11-01',
      effectiveUntil: null,
    },
  )

  assert.equal(policies.length, 1)
  assert.deepEqual(calls, ['update:2026-11-01', 'insert:policy-b'])
})

test('synchronous Drizzle billing repository rejects cross-team athlete before terms reads', () => {
  let termsReads = 0
  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          get: () => null,
          all: () => {
            if (String(table).includes('athlete_billing_terms')) termsReads += 1
            return []
          },
        }),
      }),
    }),
    insert: () => ({ values: () => ({ run: () => undefined }) }),
    update: () => ({ set: () => ({ where: () => ({ run: () => undefined }) }) }),
  }

  const repository = createSynchronousDrizzleBillingRepository(db)

  assert.equal(repository.athleteBelongsToTeam('team-a', 'athlete-b'), false)
  assert.equal(termsReads, 0)
})
