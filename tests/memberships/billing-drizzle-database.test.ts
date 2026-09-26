import assert from 'node:assert/strict'
import test from 'node:test'

import { createDrizzleBillingDatabase } from '../../lib/memberships/billing-drizzle-database'

function makeQuery(result: unknown[]) {
  return {
    select() {
      return {
        from() {
          return {
            innerJoin() {
              return {
                where: async () => result,
              }
            },
            where: async () => result,
          }
        },
      }
    },
  }
}

test('Drizzle billing database checks athlete membership before exposing economic rows', async () => {
  const db = createDrizzleBillingDatabase(makeQuery([{ id: 'athlete-a' }]) as never)

  assert.equal(await db.athleteBelongsToTeam('team-a', 'athlete-a'), true)
})

test('Drizzle billing database maps persisted H1 rows to domain records', async () => {
  const termsDb = createDrizzleBillingDatabase(makeQuery([{
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }]) as never)

  const terms = await termsDb.listBillingTerms('team-a', 'athlete-a')
  assert.deepEqual(terms, [{
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }])
})

test('Drizzle billing database rejects charge insertion when athlete is outside team scope', async () => {
  const db = createDrizzleBillingDatabase(makeQuery([]) as never)

  await assert.rejects(
    () => db.insertMonthlyCharges('team-a', 'athlete-a', [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-18',
      effectiveDueDate: '2026-10-18',
    }]),
    /athlete.*team/i,
  )
})


test('Drizzle billing database replaces the current global due-date exception without deleting history', async () => {
  const writes: Array<{ kind: string; value: Record<string, unknown> }> = []
  const existing = [{
    id: 'exception-old',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Primer ajuste',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(existing),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update() {
          return {
            set(value: Record<string, unknown>) {
              return {
                where: async () => {
                  writes.push({ kind: 'update', value })
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async (values: Record<string, unknown>[]) => {
              writes.push({ kind: 'insert', value: values[0] })
            },
          }
        },
      })
    },
  } as never)

  await db.replaceCurrentGlobalDueDateException('team-a', 2026, 10, {
    id: 'exception-new',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Segundo ajuste',
    isCurrent: true,
  })

  assert.equal(writes.length, 2)
  assert.equal(writes[0].kind, 'update')
  assert.equal(writes[0].value.isCurrent, false)
  assert.equal(writes[1].kind, 'insert')
  assert.equal(writes[1].value.id, 'exception-new')
  assert.equal(writes[1].value.isCurrent, true)
})

test('Drizzle billing database treats an identical current global due-date exception as an idempotent retry', async () => {
  let writeCount = 0
  const current = [{
    id: 'exception-current',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Feriado',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    update() {
      writeCount += 1
      throw new Error('idempotent retry must not update')
    },
    insert() {
      writeCount += 1
      throw new Error('idempotent retry must not insert')
    },
  } as never)

  await db.replaceCurrentGlobalDueDateException('team-a', 2026, 10, {
    id: 'retry-id-is-irrelevant',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Feriado',
    isCurrent: true,
  })

  assert.equal(writeCount, 0)
})


test('Drizzle billing database replaces a current global due-date exception inside one transaction', async () => {
  let transactionCount = 0
  let updateInsideTransaction = false
  let insertInsideTransaction = false
  const current = [{
    id: 'exception-old',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Primer ajuste',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      transactionCount += 1
      await callback({
        update() {
          return {
            set() {
              return {
                where: async () => {
                  updateInsideTransaction = true
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async () => {
              insertInsideTransaction = true
            },
          }
        },
      })
    },
    update() {
      throw new Error('replacement update must run inside transaction')
    },
    insert() {
      throw new Error('replacement insert must run inside transaction')
    },
  } as never)

  await db.replaceCurrentGlobalDueDateException('team-a', 2026, 10, {
    id: 'exception-new',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Segundo ajuste',
    isCurrent: true,
  })

  assert.equal(transactionCount, 1)
  assert.equal(updateInsideTransaction, true)
  assert.equal(insertInsideTransaction, true)
})


test('Drizzle billing database can atomically persist a global exception and charge due-date projections', async () => {
  let transactionCount = 0
  const writes: string[] = []

  const db = createDrizzleBillingDatabase({
    select() {
      return {
        from() {
          return {
            where: async () => [{ id: 'athlete-a' }],
            innerJoin() {
              return { where: async () => [] }
            },
          }
        },
      }
    },
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      transactionCount += 1
      await callback({
        insert() {
          return {
            values: async () => {
              writes.push('revision')
            },
          }
        },
        update() {
          return {
            set() {
              return {
                where: async () => {
                  writes.push('charge')
                },
              }
            },
          }
        },
      })
    },
  } as never)

  await db.applyGlobalDueDateExceptionAtomically?.(
    'team-a',
    2026,
    10,
    {
      id: 'exception-atomic',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Vencimiento excepcional',
      isCurrent: true,
    },
    [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-15',
      effectiveDueDate: '2026-10-15',
    }],
  )

  assert.equal(transactionCount, 1)
  assert.deepEqual(writes, ['revision', 'charge'])
})


test('atomic global exception replacement preserves revision history when a current revision already exists', async () => {
  const writes: Array<{ kind: string; value: Record<string, unknown> }> = []
  const current = [{
    id: 'exception-old',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-10',
    reason: 'Primer ajuste',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update() {
          return {
            set(value: Record<string, unknown>) {
              return {
                where: async () => {
                  writes.push({ kind: 'update', value })
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async (values: Record<string, unknown>[]) => {
              writes.push({ kind: 'insert', value: values[0] })
            },
          }
        },
      })
    },
  } as never)

  await db.applyGlobalDueDateExceptionAtomically?.(
    'team-a',
    2026,
    10,
    {
      id: 'exception-new',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Segundo ajuste',
      isCurrent: true,
    },
    [],
  )

  assert.equal(writes.length, 2)
  assert.equal(writes[0].kind, 'update')
  assert.equal(writes[0].value.isCurrent, false)
  assert.equal(writes[1].kind, 'insert')
  assert.equal(writes[1].value.isCurrent, true)
})


test('atomic global exception retry does not duplicate the revision and still converges charge projections', async () => {
  const writes: string[] = []
  const current = [{
    id: 'exception-current',
    teamId: 'team-a',
    year: 2026,
    month: 10,
    dueDate: '2026-10-15',
    reason: 'Vencimiento excepcional',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update() {
          return {
            set() {
              return {
                where: async () => {
                  writes.push('charge-update')
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async () => {
              writes.push('revision-insert')
            },
          }
        },
      })
    },
  } as never)

  await db.applyGlobalDueDateExceptionAtomically?.(
    'team-a',
    2026,
    10,
    {
      id: 'retry-with-different-id',
      teamId: 'team-a',
      year: 2026,
      month: 10,
      dueDate: '2026-10-15',
      reason: 'Vencimiento excepcional',
      isCurrent: true,
    },
    [{
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      currency: 'ARS',
      baseDueDate: '2026-10-15',
      effectiveDueDate: '2026-10-15',
    }],
  )

  assert.deepEqual(writes, ['charge-update'])
})


test('team monthly charge reprojection is constrained by team ownership', async () => {
  let teamScopeChecked = false
  const db = createDrizzleBillingDatabase({
    select() {
      return {
        from() {
          return {
            where: async () => {
              teamScopeChecked = true
              return [{ id: 'athlete-a' }]
            },
            innerJoin() {
              return { where: async () => [] }
            },
          }
        },
      }
    },
    update() {
      return {
        set() {
          return { where: async () => {} }
        },
      }
    },
  } as never)

  await db.updateMonthlyChargeDueDates?.('team-a', {
    athleteId: 'athlete-a',
    billingTermsId: 'terms-a',
    year: 2026,
    month: 10,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_500_000,
    currency: 'ARS',
    baseDueDate: '2026-10-15',
    effectiveDueDate: '2026-10-15',
  })

  assert.equal(teamScopeChecked, true)
})


test('atomic global exception application rejects charge projections outside the requested team', async () => {
  let transactionStarted = false
  const db = createDrizzleBillingDatabase({
    select() {
      return {
        from() {
          return {
            where: async () => [],
            innerJoin() {
              return { where: async () => [] }
            },
          }
        },
      }
    },
    transaction: async () => {
      transactionStarted = true
    },
  } as never)

  await assert.rejects(
    () => db.applyGlobalDueDateExceptionAtomically!(
      'team-a',
      2026,
      10,
      {
        id: 'exception-scope',
        teamId: 'team-a',
        year: 2026,
        month: 10,
        dueDate: '2026-10-15',
        reason: 'Vencimiento excepcional',
        isCurrent: true,
      },
      [{
        athleteId: 'athlete-from-other-team',
        billingTermsId: 'terms-b',
        year: 2026,
        month: 10,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_500_000,
        currency: 'ARS',
        baseDueDate: '2026-10-15',
        effectiveDueDate: '2026-10-15',
      }],
    ),
    /team.*scope|outside.*team/i,
  )
  assert.equal(transactionStarted, false)
})


test('Drizzle billing database replaces the current monthly charge reduction append-only', async () => {
  const writes: Array<{ kind: string; value: Record<string, unknown> }> = []
  const current = [{
    id: 'reduction-current',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 250_000,
    reason: 'Beca inicial',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update() {
          return {
            set(value: Record<string, unknown>) {
              return {
                where: async () => {
                  writes.push({ kind: 'update', value })
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async (values: Record<string, unknown>[]) => {
              writes.push({ kind: 'insert', value: values[0] })
            },
          }
        },
      })
    },
  } as never)

  await db.replaceCurrentMonthlyChargeReduction?.('charge-a', {
    id: 'reduction-new',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: 'Beca ampliada',
    isCurrent: true,
  })

  assert.equal(writes.length, 2)
  assert.equal(writes[0].kind, 'update')
  assert.equal(writes[0].value.isCurrent, false)
  assert.equal(writes[1].kind, 'insert')
  assert.equal(writes[1].value.isCurrent, true)
})

test('Drizzle billing database treats the same monthly charge reduction decision as an idempotent retry', async () => {
  let transactionStarted = false
  const current = [{
    id: 'reduction-current',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: 'Beca deportiva',
    isCurrent: true,
  }]

  const db = createDrizzleBillingDatabase({
    ...makeQuery(current),
    transaction: async () => {
      transactionStarted = true
    },
  } as never)

  await db.replaceCurrentMonthlyChargeReduction?.('charge-a', {
    id: 'retry-with-different-id',
    monthlyChargeId: 'charge-a',
    athleteId: 'athlete-a',
    year: 2026,
    month: 10,
    reductionAmountMinor: 500_000,
    reason: 'Beca deportiva',
    isCurrent: true,
  })

  assert.equal(transactionStarted, false)
})


test('atomic monthly charge reduction persists the revision and projected amount due together', async () => {
  const writes: Array<{ kind: string; value: Record<string, unknown> }> = []
  const db = createDrizzleBillingDatabase({
    ...makeQuery([{ id: 'athlete-a' }]),
    transaction: async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update(table: unknown) {
          return {
            set(value: Record<string, unknown>) {
              return {
                where: async () => {
                  writes.push({ kind: table === undefined ? 'unknown-update' : 'update', value })
                },
              }
            },
          }
        },
        insert() {
          return {
            values: async (values: Record<string, unknown>[]) => {
              writes.push({ kind: 'insert', value: values[0] })
            },
          }
        },
      })
    },
  } as never)

  await db.applyMonthlyChargeReductionAtomically?.(
    'team-a',
    'charge-a',
    {
      id: 'reduction-atomic',
      monthlyChargeId: 'charge-a',
      athleteId: 'athlete-a',
      year: 2026,
      month: 10,
      reductionAmountMinor: 500_000,
      reason: 'Beca deportiva',
      isCurrent: true,
    },
    {
      athleteId: 'athlete-a',
      billingTermsId: 'terms-a',
      year: 2026,
      month: 10,
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_000_000,
      currency: 'ARS',
      baseDueDate: '2026-10-10',
      effectiveDueDate: '2026-10-10',
    },
  )

  assert.equal(writes.filter((write) => write.kind === 'insert').length, 1)
  const amountUpdate = writes.find((write) => write.value.amountDueMinor === 2_000_000)
  assert.ok(amountUpdate)
  assert.equal(amountUpdate.value.baseAmountMinor, undefined)
})

test('atomic monthly charge reduction rejects a charge projection outside the requested team before writing', async () => {
  let transactionStarted = false
  const db = createDrizzleBillingDatabase({
    ...makeQuery([]),
    transaction: async () => {
      transactionStarted = true
    },
  } as never)

  await assert.rejects(
    () => db.applyMonthlyChargeReductionAtomically!(
      'team-a',
      'charge-a',
      {
        id: 'reduction-scope',
        monthlyChargeId: 'charge-a',
        athleteId: 'athlete-other-team',
        year: 2026,
        month: 10,
        reductionAmountMinor: 500_000,
        reason: 'Beca deportiva',
        isCurrent: true,
      },
      {
        athleteId: 'athlete-other-team',
        billingTermsId: 'terms-b',
        year: 2026,
        month: 10,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_000_000,
        currency: 'ARS',
        baseDueDate: '2026-10-10',
        effectiveDueDate: '2026-10-10',
      },
    ),
    /team.*scope|outside.*team/i,
  )

  assert.equal(transactionStarted, false)
})


test('reduction revision history reconstructs economic identity from the linked monthly charge', async () => {
  const db = createDrizzleBillingDatabase({
    ...makeQuery([{
      id: 'reduction-1',
      monthlyChargeId: 'charge-a',
      reductionAmountMinor: 500_000,
      reason: 'Beca deportiva',
      isCurrent: true,
      isDeleted: false,
      createdAt: '2026-09-26T12:00:00.000Z',
      updatedAt: '2026-09-26T12:00:00.000Z',
    }]),
  } as never)

  const revisions = await db.listMonthlyChargeReductionRevisions?.('charge-a')

  assert.equal(revisions?.length, 1)
  assert.equal(revisions?.[0].monthlyChargeId, 'charge-a')
  assert.equal(revisions?.[0].athleteId, 'athlete-a')
  assert.equal(revisions?.[0].year, 2026)
  assert.equal(revisions?.[0].month, 10)
})
