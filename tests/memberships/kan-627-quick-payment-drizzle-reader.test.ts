import assert from 'node:assert/strict'
import test from 'node:test'

import { createDrizzleQuickPaymentBatchReader } from '../../lib/memberships/quick-payment-drizzle-reader'

test('KAN-627 reads all requested athletes in bounded query count, not once per athlete', async () => {
  const queriedTables: unknown[] = []
  const client = {
    select() {
      return {
        from(table: unknown) {
          queriedTables.push(table)
          const rows = queriedTables.length === 1
            ? [
                { id: 'oct-a', athleteId: 'a', billingTermsId: 'terms-a', year: 2026, month: 10, baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-05' },
                { id: 'oct-b', athleteId: 'b', billingTermsId: 'terms-b', year: 2026, month: 10, baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-05' },
              ]
            : []
          return {
            innerJoin() { return this },
            where() { return Promise.resolve(rows) },
          }
        },
      }
    },
  }
  const reader = createDrizzleQuickPaymentBatchReader(client)
  const result = await reader({
    teamId: 'team-a',
    athleteIds: ['a', 'b'],
    cutoffDate: '2026-10-04',
  })
  assert.equal(queriedTables.length, 2, 'one charge query and one payment-revision query for the entire page')
  assert.deepEqual(result.map((item) => item.athleteId), ['a', 'b'])
  assert.equal(result[0]?.charges[0]?.remainingMinor, 1000)
})

test('KAN-627 refuses repository rows outside the requested athlete scope', async () => {
  const client = {
    select() {
      return {
        from() {
          return {
            innerJoin() { return this },
            where() {
              return Promise.resolve([{ id: 'foreign', athleteId: 'other-team', billingTermsId: 'terms', year: 2026, month: 10, baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-05' }])
            },
          }
        },
      }
    },
  }
  const reader = createDrizzleQuickPaymentBatchReader(client)
  await assert.rejects(reader({ teamId: 'team-a', athleteIds: ['a'], cutoffDate: '2026-10-04' }), /scope/i)
})
