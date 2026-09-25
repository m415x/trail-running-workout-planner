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
