import assert from 'node:assert/strict'
import test from 'node:test'

import { athleteBillingTerms, teamEconomicPolicies } from '../../db/schema'

import {
  createMembershipServerActionRuntime,
} from '../../lib/memberships/billing-server-action-runtime'

test('membership server action runtime uses the synchronous SQLite transaction repository', async () => {
  const calls: string[] = []
  const db = {
    transaction: (operation: () => unknown) => {
      {
        calls.push('begin')
        const result = operation()
        calls.push('commit')
        return result
      }
    },
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
    transaction: (operation: () => unknown) => {
      {
        calls.push('begin')
        const result = operation()
        calls.push('commit')
        return result
      }
    },
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
    transaction: (operation: () => unknown) => operation(),
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


test('membership Server Action runtime exposes the three H2 Coach operations without implicit writes on creation', async () => {
  const db = {
    transaction: () => {
      throw new Error('transaction must not run while creating runtime')
    },
    select: () => {
      throw new Error('read must not run while creating runtime')
    },
  }

  const runtime = createMembershipServerActionRuntime({
    db: db as any,
    createId: () => 'h2-a',
  })

  assert.equal(typeof runtime.applyGlobalDueDateException, 'function')
  assert.equal(typeof runtime.applyMonthlyChargeReduction, 'function')
  assert.equal(typeof runtime.applyMonthlyChargeExtension, 'function')
})


test('KAN-479 H2 runtime does not wrap async persistence orchestration in the synchronous SQLite transaction boundary', async () => {
  let transactionCalls = 0
  let h2TransactionCalls = 0
  const db = {
    transaction: (operation: (tx: unknown) => unknown) => {
      transactionCalls += 1
      h2TransactionCalls += 1
      return operation(db)
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: async () => [],
        }),
        where: async () => [],
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => undefined,
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
    db: db as any,
    createId: () => 'global-a',
  })

  const result = await runtime.applyGlobalDueDateException({
    teamId: 'team_1',
    year: 2026,
    month: 11,
    dueDate: '2026-11-12',
    reason: 'Una vez',
  })

  assert.deepEqual(result, { success: true })
  assert.equal(transactionCalls, 1)
  assert.equal(h2TransactionCalls, 1)
})


test('KAN-479 runtime exposes bulk monthly materialization through the established H1 persistence adapter', async () => {
  const runtime = createMembershipServerActionRuntime({
    db: {
      transaction: () => {
        throw new Error('bulk orchestration must not open the synchronous H1 transaction')
      },
      select: () => {
        throw new Error('runtime creation must not read')
      },
    } as any,
    createId: () => 'unused',
  })

  assert.equal(typeof runtime.materializeTeamMonthlyCharges, 'function')
})


test('KAN-479 new athlete billing initialization applies terms and materializes the join month as one runtime use case', async () => {
  const runtime = createMembershipServerActionRuntime({
    db: {
      transaction: () => {
        throw new Error('new-athlete billing orchestration must own its established boundaries')
      },
      select: () => {
        throw new Error('runtime creation must not read')
      },
    } as any,
    createId: () => 'unused',
  })

  assert.equal(typeof runtime.initializeNewAthleteBilling, 'function')
})


test('KAN-479 new athlete billing initialization rejects creation without an effective economic policy', async () => {
  let insertCalls = 0
  const db = {
    transaction: (operation: (tx: unknown) => unknown) => operation(db),
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => ({ id: 'athlete-new' }),
          all: () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => {
          insertCalls += 1
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
    db: db as any,
    createId: () => 'terms-new',
    reportError: () => undefined,
  })

  const result = await runtime.initializeNewAthleteBilling({
    teamId: 'team_1',
    athleteId: 'athlete-new',
    effectiveFrom: '2026-09-27',
  })

  assert.deepEqual(result, {
    success: false,
    error: 'Could not initialize new athlete billing',
  })
  assert.equal(insertCalls, 0)
})
