import assert from 'node:assert/strict'
import test from 'node:test'

import {
  configureTeamEconomicPolicySynchronously,
} from '../../lib/memberships/billing-sqlite-coach-actions'

test('SQLite Coach policy action keeps repository work inside the synchronous transaction', () => {
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
          all: () => {
            calls.push('list')
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
      set: () => ({
        where: () => ({
          run: () => calls.push('update'),
        }),
      }),
    }),
  }

  const result = configureTeamEconomicPolicySynchronously({
    db,
    createId: () => 'policy-a',
    input: {
      teamId: 'team-a',
      effectiveFrom: '2026-10-01',
      defaultMonthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
    },
  })

  assert.equal(result.id, 'policy-a')
  assert.deepEqual(calls, ['begin', 'list', 'insert:policy-a', 'commit'])
})
