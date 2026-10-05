import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteHomeEconomicAccountAdapter } from '../../lib/memberships/athlete-home-economic-account-adapter'

test('KAN-633 account adapter scopes membership checks, charge reads and payment reads by athlete/team', async () => {
  const calls: string[] = []
  const charge = {
    id: 'oct', athleteId: 'ath-a', billingTermsId: 'term-a', year: 2026, month: 10,
    amountDueMinor: 2500000, currency: 'ARS', baseDueDate: '2026-10-05',
    effectiveDueDate: '2026-10-15',
  }
  const read = createAthleteHomeEconomicAccountAdapter({
    createPort: () => ({
      athleteBelongsToTeam: async (teamId: string, athleteId: string) => {
        calls.push('scope:' + teamId + ':' + athleteId)
        return teamId === 'team-a' && athleteId === 'ath-a'
      },
      listBillingTerms: async (teamId: string, athleteId: string) => {
        calls.push('terms:' + teamId + ':' + athleteId)
        return [{ id: 'term-a' }]
      },
      listPersistedMonthlyCharges: async (teamId: string, athleteId: string) => {
        calls.push('charges:' + teamId + ':' + athleteId)
        return [charge]
      },
      listPaymentRevisions: async (chargeId: string) => {
        calls.push('payments:' + chargeId)
        return []
      },
    }),
  })
  const result = await read({ teamId: 'team-a', athleteId: 'ath-a', cutoffDate: '2026-10-06' })
  assert.equal(result.available, true)
  assert.equal(result.blockedForPriorDebt, false)
  assert.deepEqual(result.charges.map(c => [c.year, c.month, c.status, c.remainingMinor]), [
    [2026, 10, 'pending', 2500000],
  ])
  assert.deepEqual(calls, ['scope:team-a:ath-a', 'terms:team-a:ath-a', 'charges:team-a:ath-a', 'payments:oct'])
  calls.length = 0
  await assert.rejects(read({ teamId: 'team-b', athleteId: 'ath-a', cutoffDate: '2026-10-06' }))
  assert.deepEqual(calls, ['scope:team-b:ath-a'])
})

test('KAN-633 missing terms or charges is unavailable, not economically settled', async () => {
  const read = createAthleteHomeEconomicAccountAdapter({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [],
      listPersistedMonthlyCharges: async () => [],
      listPaymentRevisions: async () => [],
    }),
  })
  assert.deepEqual(await read({ teamId: 'team-a', athleteId: 'ath-a', cutoffDate: '2026-10-06' }), {
    available: false, blockedForPriorDebt: false, charges: [],
  })
})
