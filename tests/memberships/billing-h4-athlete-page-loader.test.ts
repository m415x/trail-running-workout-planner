import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipPageLoader } from '../../lib/memberships/athlete-membership-page-loader'

test('athlete membership page loader derives H4 account state and explainable history from an explicit civil cutoff date', async () => {
  const globalCalls: Array<{ teamId: string; year: number; month: number }> = []

  const load = createAthleteMembershipPageLoader({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async () => [{
        id: 'terms-1',
        athleteId: 'athlete-1',
        monthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        effectiveFrom: '2026-09-01',
        effectiveUntil: null,
      }],
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
        baseDueDate: '2026-09-08',
        effectiveDueDate: '2026-09-12',
        dueDate: '2026-09-12',
      }],
      listTeamEconomicPolicies: async () => [],
      insertMonthlyCharges: async () => {
        throw new Error('read path must not materialize charges')
      },
      listGlobalDueDateExceptionRevisions: async (teamId, year, month) => {
        globalCalls.push({ teamId, year, month })
        return [{
          id: 'global-1',
          teamId,
          year,
          month,
          dueDate: '2026-09-08',
          reason: 'Holiday adjustment',
          isCurrent: true,
        }]
      },
      replaceCurrentGlobalDueDateException: async () => {
        throw new Error('read path must not replace global exceptions')
      },
      listTeamMonthlyCharges: async () => [],
      getBillingTermsById: async () => { throw new Error('unused') },
      updateMonthlyChargeDueDates: async () => {
        throw new Error('read path must not update due dates')
      },
      listMonthlyChargeReductionRevisions: async () => [{
        id: 'reduction-1',
        monthlyChargeId: 'charge-1',
        athleteId: 'athlete-1',
        year: 2026,
        month: 9,
        reductionAmountMinor: 500_000,
        reason: 'Scholarship',
        isCurrent: true,
      }],
      replaceCurrentMonthlyChargeReduction: async () => {
        throw new Error('read path must not replace reductions')
      },
      listMonthlyChargeExtensionRevisions: async () => [{
        id: 'extension-1',
        monthlyChargeId: 'charge-1',
        athleteId: 'athlete-1',
        year: 2026,
        month: 9,
        extendedDueDate: '2026-09-12',
        reason: 'Individual extension',
        isCurrent: true,
      }],
      replaceCurrentMonthlyChargeExtension: async () => {
        throw new Error('read path must not replace extensions')
      },
      listPaymentRevisions: async () => [{
        revisionId: 'payment-rev-1',
        paymentId: 'payment-1',
        monthlyChargeId: 'charge-1',
        amountMinor: 750_000,
        paymentMethod: 'cash' as const,
        paidAt: '2026-09-05',
        voided: false,
        isCurrent: true,
      }],
      insertPaymentRevision: async () => {
        throw new Error('read path must not insert payments')
      },
    }),
  })

  const model = await load({
    db: 'db-client',
    locale: 'es',
    teamId: 'team-1',
    athleteId: 'athlete-1',
    onDate: '2026-09-01',
    cutoffDate: '2026-09-13',
  })

  assert.deepEqual(globalCalls, [{
    teamId: 'team-1',
    year: 2026,
    month: 9,
  }])

  assert.equal(model.accountState.cutoffDate, '2026-09-13')
  assert.deepEqual(model.accountState.charges, [{
    id: 'charge-1',
    currency: 'ARS',
    amountDueMinor: 2_000_000,
    paidMinor: 750_000,
    remainingMinor: 1_250_000,
    effectiveDueDate: '2026-09-12',
    status: 'overdue',
  }])
  assert.deepEqual(model.accountState.balanceByCurrency, [{
    currency: 'ARS',
    amountDueMinor: 2_000_000,
    paidMinor: 750_000,
    remainingMinor: 1_250_000,
  }])

  assert.equal(model.economicHistory.length, 1)
  assert.equal(model.economicHistory[0]?.condition.billingTermsId, 'terms-1')
  assert.equal(model.economicHistory[0]?.globalDueDateHistory[0]?.id, 'global-1')
  assert.equal(model.economicHistory[0]?.reductionHistory[0]?.id, 'reduction-1')
  assert.equal(model.economicHistory[0]?.extensionHistory[0]?.id, 'extension-1')
  assert.equal(model.economicHistory[0]?.paymentHistory[0]?.revisionId, 'payment-rev-1')
  assert.deepEqual(model.economicHistory[0]?.result, {
    status: 'overdue',
    amountDueMinor: 2_000_000,
    paidMinor: 750_000,
    remainingMinor: 1_250_000,
    effectiveDueDate: '2026-09-12',
    currency: 'ARS',
  })
})
