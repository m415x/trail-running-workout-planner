import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { deriveMembershipDebtExperience } from '../../lib/memberships/billing'

test('H5 cross-surface contract keeps prior-month pending extensions unblocked and prior-month overdue charges blocked', () => {
  const pending = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [{
      id: 'august-extended',
      year: 2026,
      month: 8,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 0,
      remainingMinor: 2_500_000,
      effectiveDueDate: '2026-09-30',
      status: 'pending',
    }],
  })

  assert.equal(pending.blockedForPriorDebt, false)

  const overdue = deriveMembershipDebtExperience({
    asOfDate: '2026-10-01',
    charges: [{
      ...pending.charges[0],
      effectiveDueDate: '2026-09-30',
      status: 'overdue',
    }],
  })

  assert.equal(overdue.blockedForPriorDebt, true)
  assert.deepEqual(overdue.blockingChargeIds, ['august-extended'])
})

test('H5 cross-surface contract keeps current-month overdue non-blocking and settlement removes prior blocking', () => {
  const currentMonthOverdue = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [{
      id: 'september-overdue',
      year: 2026,
      month: 9,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 0,
      remainingMinor: 2_500_000,
      effectiveDueDate: '2026-09-05',
      status: 'overdue',
    }],
  })

  assert.equal(currentMonthOverdue.blockedForPriorDebt, false)

  const settledPrior = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [{
      id: 'august-settled',
      year: 2026,
      month: 8,
      currency: 'ARS',
      amountDueMinor: 2_500_000,
      paidMinor: 2_500_000,
      remainingMinor: 0,
      effectiveDueDate: '2026-08-05',
      status: 'settled',
    }],
  })

  assert.equal(settledPrior.blockedForPriorDebt, false)
})

test('Coach and Athlete surfaces consume the same derived debtExperience and do not persist an H5 authority', () => {
  const coachSource = readFileSync('app/[locale]/dashboard/athletes/[athleteId]/page.tsx', 'utf8')
  const athleteSource = readFileSync('app/[locale]/(mobile)/profile/page.tsx', 'utf8')
  const loaderSource = readFileSync('lib/memberships/athlete-membership-page-loader.ts', 'utf8')

  assert.match(coachSource, /debtExperience=\{membership\.debtExperience\}/)
  assert.match(athleteSource, /debtExperience=\{membership\.debtExperience\}/)
  assert.match(loaderSource, /deriveMembershipDebtExperience/)
  assert.doesNotMatch(loaderSource, /insert.*Debt|update.*Debt|save.*Debt|persist.*Debt/i)
})

test('H5 presentation keeps monetary currencies separate and introduces no FX or cross-currency aggregate', () => {
  const billingSource = readFileSync('lib/memberships/billing.ts', 'utf8')
  const athleteUiSource = readFileSync('features/memberships/components/AthleteMembershipStatus.tsx', 'utf8')
  const coachUiSource = readFileSync('features/memberships/components/MembershipAccountState.tsx', 'utf8')

  assert.doesNotMatch(billingSource, /exchangeRate|fxRate|convertCurrency|convertedAmount/i)
  assert.doesNotMatch(athleteUiSource, /totalRemainingMinor|totalBalance/i)
  assert.match(coachUiSource, /balanceByCurrency/)
})
