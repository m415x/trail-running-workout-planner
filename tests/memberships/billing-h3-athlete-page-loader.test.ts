import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipPageLoader } from '../../lib/memberships/athlete-membership-page-loader'

test('athlete membership page loader exposes H3 payment history and derived charge balances', async () => {
  const load = createAthleteMembershipPageLoader({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [],
      listMonthlyCharges: async () => [],
      listPersistedMonthlyCharges: async () => [{
        id: 'charge-1',
        athleteId: 'athlete-1',
        billingTermsId: 'terms-1',
        year: 2026,
        month: 9,
        currency: 'ARS',
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_000_000,
        baseDueDate: '2026-09-05',
        effectiveDueDate: '2026-09-05',
        dueDate: '2026-09-05',
      }],
      listTeamEconomicPolicies: async () => [],
      insertMonthlyCharges: async () => {},
      listGlobalDueDateExceptionRevisions: async () => [],
      replaceCurrentGlobalDueDateException: async () => {},
      listTeamMonthlyCharges: async () => [],
      getBillingTermsById: async () => { throw new Error('unused') },
      updateMonthlyChargeDueDates: async () => {},
      listMonthlyChargeReductionRevisions: async () => [],
      replaceCurrentMonthlyChargeReduction: async () => {},
      listMonthlyChargeExtensionRevisions: async () => [],
      replaceCurrentMonthlyChargeExtension: async () => {},
      listPaymentRevisions: async () => [
        {
          revisionId: 'rev-1',
          paymentId: 'payment-1',
          monthlyChargeId: 'charge-1',
          amountMinor: 750_000,
          paymentMethod: 'cash' as const,
          paidAt: '2026-09-12',
          voided: false,
          isCurrent: true,
        },
      ],
      insertPaymentRevision: async () => {},
    }),
  })

  const model = await load({
    db: 'db-client',
    locale: 'es',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    onDate: '2026-09-27',
  })

  assert.deepEqual(model.monthlyCharges, [{
    id: 'charge-1',
    year: 2026,
    month: 9,
    currency: 'ARS',
    amountDueMinor: 2_000_000,
    paidAmountMinor: 750_000,
    remainingAmountMinor: 1_250_000,
  }])
  assert.equal(model.paymentHistory.length, 1)
  assert.equal(model.paymentHistory[0]?.paymentId, 'payment-1')
  assert.equal(model.paymentHistory[0]?.isCurrent, true)
})
