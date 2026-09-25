import assert from 'node:assert/strict'
import test from 'node:test'

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
