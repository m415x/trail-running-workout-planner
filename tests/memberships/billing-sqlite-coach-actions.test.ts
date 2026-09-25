import assert from 'node:assert/strict'
import test from 'node:test'

import { athleteBillingTerms, teamEconomicPolicies } from '../../db/schema'

import {
  configureTeamEconomicPolicySynchronously,
  applyInitialAthleteBillingTermsSynchronously,
  changeAthleteBillingTermsSynchronously,
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


test('SQLite Coach athlete terms actions keep scope reads and writes inside the transaction', () => {
  const calls: string[] = []
  let terms = [{
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null as string | null,
  }]

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
          get: () => {
            calls.push('scope')
            return { id: 'athlete-a', teamId: 'team-a' }
          },
          all: () => {
            if (table === teamEconomicPolicies) return [{
              id: 'policy-a',
              teamId: 'team-a',
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

  const initial = applyInitialAthleteBillingTermsSynchronously({
    db,
    createId: () => 'terms-initial',
    input: {
      teamId: 'team-a',
      athleteId: 'athlete-a',
      effectiveFrom: '2026-10-18',
    },
  })

  assert.equal(initial.id, 'terms-initial')
  assert.equal(calls[0], 'begin')
  assert.equal(calls.at(-1), 'commit')

  calls.length = 0
  terms = [{
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }]

  const changed = changeAthleteBillingTermsSynchronously({
    db,
    createId: () => 'terms-b',
    input: {
      teamId: 'team-a',
      athleteId: 'athlete-a',
      effectiveFrom: '2026-11-01',
      monthlyAmountMinor: 3_000_000,
      currency: 'ARS',
    },
  })

  assert.equal(changed.id, 'terms-b')
  assert.deepEqual(calls.filter((call) => call === 'begin' || call === 'commit'), ['begin', 'commit'])
  assert.ok(calls.includes('update:2026-11-01'))
  assert.ok(calls.includes('insert:terms-b'))
})
