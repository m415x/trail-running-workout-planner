import assert from 'node:assert/strict'
import test from 'node:test'

import { athleteBillingTerms, teamEconomicPolicies } from '../../db/schema'

import {
  createMembershipServerActionRuntime,
} from '../../lib/memberships/billing-server-action-runtime'

test('membership server action runtime uses the synchronous SQLite transaction repository', async () => {
  const calls: string[] = []
  const db = {
    transaction: (operation: () => unknown) => ({
      immediate: () => {
        calls.push('begin')
        const result = operation()
        calls.push('commit')
        return result
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => [],
        }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        run: () => calls.push(`insert:${String(value.id)}`),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: () => calls.push('update'),
        }),
      }),
    }),
  }

  const runtime = createMembershipServerActionRuntime({
    db,
    createId: () => 'policy-a',
  })

  const result = await runtime.configureTeamEconomicPolicy({
    teamId: 'team_1',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, ['begin', 'insert:policy-a', 'commit'])
})


test('membership Server Action runtime applies and changes athlete terms inside synchronous SQLite transactions', async () => {
  const calls: string[] = []
  let terms: Array<Record<string, unknown>> = []
  const db = {
    transaction: (operation: () => unknown) => ({
      immediate: () => {
        calls.push('begin')
        const result = operation()
        calls.push('commit')
        return result
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          get: () => ({ id: 'athlete-a', teamId: 'team_1' }),
          all: () => {
            if (table === teamEconomicPolicies) return [{
              id: 'policy-a',
              teamId: 'team_1',
              defaultMonthlyAmountMinor: 2_500_000,
              currency: 'ARS',
              ordinaryDueDay: 5,
              effectiveFrom: '2026-10-01',
              effectiveUntil: null,
            }]
            if (table === athleteBillingTerms) return terms
            return []
          },
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

  const ids = ['terms-initial', 'terms-next']
  const runtime = createMembershipServerActionRuntime({
    db,
    createId: () => ids.shift()!,
  })

  const initial = await runtime.applyInitialAthleteBillingTerms({
    teamId: 'team_1',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-10-18',
  })
  assert.deepEqual(initial, { success: true })
  assert.deepEqual(calls.filter((call) => call === 'begin' || call === 'commit'), ['begin', 'commit'])
  assert.ok(calls.includes('insert:terms-initial'))

  calls.length = 0
  terms = [{
    id: 'terms-initial',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }]

  const changed = await runtime.changeAthleteBillingTerms({
    teamId: 'team_1',
    athleteId: 'athlete-a',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  })
  assert.deepEqual(changed, { success: true })
  assert.deepEqual(calls.filter((call) => call === 'begin' || call === 'commit'), ['begin', 'commit'])
  assert.ok(calls.includes('update:2026-11-01'))
  assert.ok(calls.includes('insert:terms-next'))
})


test('membership Server Action runtime reports the original policy write failure to its diagnostic boundary', async () => {
  const failure = new Error('SQLITE_CONSTRAINT diagnostic')
  const reported: unknown[] = []
  const db = {
    transaction: (operation: () => unknown) => ({
      immediate: () => operation(),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          all: () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => {
          throw failure
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: () => undefined,
        }),
      }),
    }),
  }

  const runtime = createMembershipServerActionRuntime({
    db,
    createId: () => 'policy-a',
    reportError: (error) => reported.push(error),
  })

  const result = await runtime.configureTeamEconomicPolicy({
    teamId: 'team_1',
    effectiveFrom: '2026-10-01',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
  })

  assert.deepEqual(result, {
    success: false,
    error: 'Could not configure team economic policy',
  })
  assert.deepEqual(reported, [failure])
})
