import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteHomeEconomicAccountAdapter } from '../../lib/memberships/athlete-home-economic-account-adapter'

test('KAN-633 cannot silently fall back to N payment queries when batch capability is missing', async () => {
  let individualReads = 0
  const read = createAthleteHomeEconomicAccountAdapter({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [{ id: 'terms-1' }],
      listPersistedMonthlyCharges: async () => [8, 9, 10].map(month => ({
        id: 'charge-' + month,
        athleteId: 'athlete-1', billingTermsId: 'terms-1', year: 2026, month,
        baseAmountMinor: 1000, amountDueMinor: 1000, currency: 'ARS',
        baseDueDate: '2026-' + String(month) + '-05',
        effectiveDueDate: '2026-' + String(month) + '-05',
      })),
      listPaymentRevisions: async () => {
        individualReads++
        return []
      },
    }),
  })

  await assert.rejects(read({ teamId: 'team-1', athleteId: 'athlete-1', cutoffDate: '2026-10-06' }), /batch/i)
  assert.equal(individualReads, 0, 'the Home reader must not perform a per-charge fallback')
})
