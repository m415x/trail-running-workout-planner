import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteHomeEconomicAccountAdapter } from '../../lib/memberships/athlete-home-economic-account-adapter'

test('KAN-633 uses one batch payment read for multiple charges rather than one read per charge', async () => {
  const calls: string[] = []
  const charges = [8, 9, 10].map(month => ({
    id: 'charge-' + month,
    athleteId: 'athlete-1',
    billingTermsId: 'terms-1',
    year: 2026,
    month,
    baseAmountMinor: 1000,
    amountDueMinor: 1000,
    currency: 'ARS',
    baseDueDate: '2026-' + String(month).padStart(2, '0') + '-05',
    effectiveDueDate: '2026-' + String(month).padStart(2, '0') + '-05',
  }))
  const read = createAthleteHomeEconomicAccountAdapter({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [{ id: 'terms-1' }],
      listPersistedMonthlyCharges: async () => charges,
      listPaymentRevisions: async (chargeId: string) => {
        calls.push('individual:' + chargeId)
        return []
      },
      listPaymentRevisionsForCharges: async (chargeIds: readonly string[]) => {
        calls.push('batch:' + chargeIds.join(','))
        return []
      },
    }),
  })
  const result = await read({ teamId: 'team-1', athleteId: 'athlete-1', cutoffDate: '2026-10-06' })
  assert.equal(result.available, true)
  assert.equal(result.blockedForPriorDebt, true)
  assert.deepEqual(calls, ['batch:charge-8,charge-9,charge-10'])
})

test('KAN-633 rejects unscoped batch payment results rather than leaking another charge', async () => {
  const charge = {
    id: 'charge-10', athleteId: 'athlete-1', billingTermsId: 'terms-1',
    year: 2026, month: 10, baseAmountMinor: 1000, amountDueMinor: 1000,
    currency: 'ARS', baseDueDate: '2026-10-05', effectiveDueDate: '2026-10-05',
  }
  const read = createAthleteHomeEconomicAccountAdapter({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [{ id: 'terms-1' }],
      listPersistedMonthlyCharges: async () => [charge],
      listPaymentRevisions: async () => [],
      listPaymentRevisionsForCharges: async () => [{
        revisionId: 'foreign-revision', paymentId: 'foreign-payment', monthlyChargeId: 'foreign-charge',
        amountMinor: 100, paymentMethod: 'cash' as const, paidAt: '2026-10-01',
        voided: false, isCurrent: true,
      }],
    }),
  })
  await assert.rejects(read({ teamId: 'team-1', athleteId: 'athlete-1', cutoffDate: '2026-10-06' }), /scope|charge/i)
})
