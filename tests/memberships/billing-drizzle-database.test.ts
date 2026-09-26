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
