import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipPageLoader } from '../../lib/memberships/athlete-membership-page-loader'

function createPort(paymentAmountMinor: number) {
  return {
    athleteBelongsToTeam: async () => true,
    listBillingTerms: async () => [{
      id: 'terms-1',
      athleteId: 'athlete-1',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-08-01',
      effectiveUntil: null,
    }],
    listMonthlyCharges: async () => [],
    listPersistedMonthlyCharges: async () => [{
      id: 'charge-august',
      athleteId: 'athlete-1',
      billingTermsId: 'terms-1',
      year: 2026,
      month: 8,
      currency: 'ARS',
      baseAmountMinor: 2_500_000,
      amountDueMinor: 2_500_000,
      baseDueDate: '2026-08-05',
      effectiveDueDate: '2026-08-20',
      dueDate: '2026-08-20',
    }],
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {
      throw new Error('read path must not materialize charges')
    },
    listGlobalDueDateExceptionRevisions: async () => [],
    replaceCurrentGlobalDueDateException: async () => {
      throw new Error('read path must not replace global exceptions')
    },
    listTeamMonthlyCharges: async () => [],
    getBillingTermsById: async () => { throw new Error('unused') },
    updateMonthlyChargeDueDates: async () => {
      throw new Error('read path must not update due dates')
    },
    listMonthlyChargeReductionRevisions: async () => [],
    replaceCurrentMonthlyChargeReduction: async () => {
      throw new Error('read path must not replace reductions')
    },
    listMonthlyChargeExtensionRevisions: async () => [{
      id: 'extension-1',
      monthlyChargeId: 'charge-august',
      athleteId: 'athlete-1',
      year: 2026,
      month: 8,
      extendedDueDate: '2026-08-20',
      reason: 'Individual extension',
      isCurrent: true,
    }],
    replaceCurrentMonthlyChargeExtension: async () => {
      throw new Error('read path must not replace extensions')
    },
    listPaymentRevisions: async () => paymentAmountMinor === 0
      ? []
      : [{
          revisionId: 'payment-rev-1',
          paymentId: 'payment-1',
          monthlyChargeId: 'charge-august',
          amountMinor: paymentAmountMinor,
          paymentMethod: 'cash' as const,
          paidAt: '2026-09-01',
          voided: false,
          isCurrent: true,
        }],
    insertPaymentRevision: async () => {
      throw new Error('read path must not insert payments')
    },
  }
}

test('athlete read model composes H5 prior-debt blocking from H4 using the explicit civil cutoff date', async () => {
  const load = createAthleteMembershipPageLoader({
    createPort: () => createPort(0),
  })

  const model = await load({
    db: 'db-client',
    locale: 'es',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    onDate: '2026-09-27',
    cutoffDate: '2026-09-27',
  })

  assert.equal(model.accountState.charges[0]?.status, 'overdue')
  assert.deepEqual(model.debtExperience, {
    asOfDate: '2026-09-27',
    blockedForPriorDebt: true,
    blockingChargeIds: ['charge-august'],
    charges: [{
      id: 'charge-august',
      year: 2026,
      month: 8,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 0,
      remainingMinor: 2_500_000,
      effectiveDueDate: '2026-08-20',
      status: 'overdue',
    }],
  })
})

test('athlete read model removes H5 blocking when H3 payment makes the prior charge settled', async () => {
  const load = createAthleteMembershipPageLoader({
    createPort: () => createPort(2_500_000),
  })

  const model = await load({
    db: 'db-client',
    locale: 'es',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    onDate: '2026-09-27',
    cutoffDate: '2026-09-27',
  })

  assert.equal(model.accountState.charges[0]?.status, 'settled')
  assert.equal(model.debtExperience.blockedForPriorDebt, false)
  assert.deepEqual(model.debtExperience.blockingChargeIds, [])
})

test('athlete read model keeps cross-currency account balances separated while H5 remains non-monetary', async () => {
  const load = createAthleteMembershipPageLoader({
    createPort: () => ({
      ...createPort(0),
      listBillingTerms: async () => [
        {
          id: 'terms-ars',
          athleteId: 'athlete-1',
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-07-01',
          effectiveUntil: '2026-08-01',
        },
        {
          id: 'terms-usd',
          athleteId: 'athlete-1',
          monthlyAmountMinor: 10_000,
          currency: 'USD',
          effectiveFrom: '2026-08-01',
          effectiveUntil: null,
        },
      ],
      listPersistedMonthlyCharges: async () => [
        {
          id: 'charge-ars',
          athleteId: 'athlete-1',
          billingTermsId: 'terms-ars',
          year: 2026,
          month: 7,
          currency: 'ARS',
          baseAmountMinor: 2_500_000,
          amountDueMinor: 2_500_000,
          baseDueDate: '2026-07-05',
          effectiveDueDate: '2026-07-05',
          dueDate: '2026-07-05',
        },
        {
          id: 'charge-usd',
          athleteId: 'athlete-1',
          billingTermsId: 'terms-usd',
          year: 2026,
          month: 8,
          currency: 'USD',
          baseAmountMinor: 10_000,
          amountDueMinor: 10_000,
          baseDueDate: '2026-08-05',
          effectiveDueDate: '2026-08-05',
          dueDate: '2026-08-05',
        },
      ],
      listMonthlyChargeExtensionRevisions: async () => [],
      listPaymentRevisions: async () => [],
    }),
  })

  const model = await load({
    db: 'db-client',
    locale: 'es',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    onDate: '2026-09-27',
    cutoffDate: '2026-09-27',
  })

  assert.deepEqual(
    model.accountState.balanceByCurrency.map((item) => item.currency),
    ['ARS', 'USD'],
  )
  assert.equal(model.debtExperience.blockedForPriorDebt, true)
  assert.equal('totalRemainingMinor' in model.debtExperience, false)
})
