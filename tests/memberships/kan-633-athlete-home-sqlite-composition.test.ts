import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteHomeEconomicSqliteReader } from '../../lib/memberships/athlete-home-economic-sqlite-reader'

test('KAN-633 composes the real scoped SQLite billing ports with H4/H5 and the Home summary', async () => {
  const calls: string[] = []
  const createDatabase = () => ({
    athleteBelongsToTeam: async (team: string, athlete: string) => {
      calls.push('scope:' + team + ':' + athlete)
      return team === 'team-1' && athlete === 'athlete-1'
    },
    listBillingTerms: async (team: string, athlete: string) => {
      calls.push('terms:' + team + ':' + athlete)
      return [{ id: 'terms-1' }]
    },
    listPersistedMonthlyCharges: async (team: string, athlete: string) => {
      calls.push('charges:' + team + ':' + athlete)
      return [{ id: 'oct', athleteId: 'athlete-1', billingTermsId: 'terms-1', year: 2026, month: 10,
        baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS',
        baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-15' }]
    },
    listPaymentRevisionsForCharges: async (ids: readonly string[]) => {
      calls.push('payments:' + ids.join(','))
      return []
    },
  })
  const read = createAthleteHomeEconomicSqliteReader({ createDatabase })
  const result = await read({ teamId: 'team-1', athleteId: 'athlete-1', cutoffDate: '2026-10-06' })
  assert.deepEqual(result, {
    available: true, blockedForPriorDebt: false,
    currentCharge: { status: 'pending', remainingMinor: 1000 },
  })
  assert.deepEqual(calls, [
    'scope:team-1:athlete-1', 'terms:team-1:athlete-1',
    'charges:team-1:athlete-1', 'payments:oct',
  ])
  calls.length = 0
  assert.deepEqual(await read({ teamId: 'team-2', athleteId: 'athlete-1', cutoffDate: '2026-10-06' }), {
    available: false, blockedForPriorDebt: false, currentCharge: null,
  })
  assert.deepEqual(calls, ['scope:team-2:athlete-1'])
})
