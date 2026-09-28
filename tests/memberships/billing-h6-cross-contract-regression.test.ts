import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyMonthlyChargeExtension,
  applyPaymentRevision,
  deriveMembershipAccountState,
  deriveMembershipDebtExperience,
  projectMonthlyChargeWithExceptions,
  type MonthlyChargeCandidate,
} from '../../lib/memberships/billing'

const baseCharge: MonthlyChargeCandidate = {
  athleteId: 'athlete-1',
  billingTermsId: 'terms-1',
  year: 2026,
  month: 8,
  baseAmountMinor: 2_500_000,
  amountDueMinor: 2_500_000,
  currency: 'ARS',
  baseDueDate: '2026-08-05',
  effectiveDueDate: '2026-08-05',
}

function debtExperienceAt(input: {
  cutoffDate: string
  charge: MonthlyChargeCandidate
  paymentRevisions?: ReturnType<typeof applyPaymentRevision>
}) {
  const account = deriveMembershipAccountState({
    cutoffDate: input.cutoffDate,
    charges: [{
      id: 'charge-august',
      charge: input.charge,
      paymentRevisions: input.paymentRevisions ?? [],
    }],
  })

  return {
    account,
    debt: deriveMembershipDebtExperience({
      asOfDate: input.cutoffDate,
      charges: account.charges.map(charge => ({
        ...charge,
        year: input.charge.year,
        month: input.charge.month,
      })),
    }),
  }
}

test('H2 extension flows through H4 into H5 without blocking until the extension expires', () => {
  const extensions = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge: baseCharge,
    extendedDueDate: '2026-09-30',
    reason: 'Prórroga acordada',
  })

  const projected = projectMonthlyChargeWithExceptions({
    charge: baseCharge,
    globalDueDateException: null,
    reductionRevisions: [],
    extensionRevisions: extensions,
  })

  const onExtendedDueDate = debtExperienceAt({
    cutoffDate: '2026-09-30',
    charge: projected,
  })

  assert.equal(onExtendedDueDate.account.charges[0]?.status, 'pending')
  assert.equal(onExtendedDueDate.debt.blockedForPriorDebt, false)

  const afterExtendedDueDate = debtExperienceAt({
    cutoffDate: '2026-10-01',
    charge: projected,
  })

  assert.equal(afterExtendedDueDate.account.charges[0]?.status, 'overdue')
  assert.equal(afterExtendedDueDate.debt.blockedForPriorDebt, true)
  assert.deepEqual(afterExtendedDueDate.debt.blockingChargeIds, ['charge-august'])
})

test('H3 settlement recomputes H4 settled and clears the H5 prior-debt block', () => {
  const extensions = applyMonthlyChargeExtension({
    revisions: [],
    id: 'extension-1',
    charge: baseCharge,
    extendedDueDate: '2026-09-30',
    reason: 'Prórroga acordada',
  })

  const projected = projectMonthlyChargeWithExceptions({
    charge: baseCharge,
    globalDueDateException: null,
    reductionRevisions: [],
    extensionRevisions: extensions,
  })

  const payments = applyPaymentRevision({
    revisions: [],
    revisionId: 'payment-revision-1',
    paymentId: 'payment-1',
    monthlyChargeId: 'charge-august',
    amountMinor: projected.amountDueMinor,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-10-01',
    voided: false,
  })

  const settled = debtExperienceAt({
    cutoffDate: '2026-10-01',
    charge: projected,
    paymentRevisions: payments,
  })

  assert.equal(settled.account.charges[0]?.status, 'settled')
  assert.equal(settled.account.charges[0]?.remainingMinor, 0)
  assert.equal(settled.debt.blockedForPriorDebt, false)
  assert.deepEqual(settled.debt.blockingChargeIds, [])
})
