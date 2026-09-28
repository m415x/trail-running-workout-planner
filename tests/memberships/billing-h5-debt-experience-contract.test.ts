import assert from 'node:assert/strict'
import test from 'node:test'

import { deriveMembershipDebtExperience } from '../../lib/memberships/billing'

const charge = ({
  id,
  year,
  month,
  status,
  currency = 'ARS',
}: {
  id: string
  year: number
  month: number
  status: 'settled' | 'pending' | 'overdue'
  currency?: 'ARS' | 'USD'
}) => ({
  id,
  year,
  month,
  currency,
  amountDueMinor: 2_500_000,
  paidMinor: status === 'settled' ? 2_500_000 : 0,
  remainingMinor: status === 'settled' ? 0 : 2_500_000,
  effectiveDueDate: status === 'pending' ? '2026-09-30' : '2026-09-05',
  status,
})

test('blocks when a prior civil-month charge is already overdue in H4', () => {
  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [
      charge({ id: 'august', year: 2026, month: 8, status: 'overdue' }),
      charge({ id: 'september', year: 2026, month: 9, status: 'pending' }),
    ],
  })

  assert.equal(result.blockedForPriorDebt, true)
  assert.deepEqual(result.blockingChargeIds, ['august'])
})

test('does not block a prior-month charge that remains pending under an effective extension', () => {
  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [
      charge({ id: 'august-extended', year: 2026, month: 8, status: 'pending' }),
    ],
  })

  assert.equal(result.blockedForPriorDebt, false)
  assert.deepEqual(result.blockingChargeIds, [])
})

test('blocks after the same prior-month charge becomes overdue when its extension expires', () => {
  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-10-01',
    charges: [
      charge({ id: 'august-extension-expired', year: 2026, month: 8, status: 'overdue' }),
    ],
  })

  assert.equal(result.blockedForPriorDebt, true)
  assert.deepEqual(result.blockingChargeIds, ['august-extension-expired'])
})

test('shows current-month overdue state without deriving prior-debt blocking', () => {
  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [
      charge({ id: 'september-overdue', year: 2026, month: 9, status: 'overdue' }),
    ],
  })

  assert.equal(result.blockedForPriorDebt, false)
  assert.deepEqual(result.blockingChargeIds, [])
})

test('stops blocking after the prior debt is settled by H4 recomputation', () => {
  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges: [
      charge({ id: 'august-settled', year: 2026, month: 8, status: 'settled' }),
    ],
  })

  assert.equal(result.blockedForPriorDebt, false)
  assert.deepEqual(result.blockingChargeIds, [])
})

test('preserves charge currencies and never creates a cross-currency monetary aggregate', () => {
  const charges = [
    charge({ id: 'ars-debt', year: 2026, month: 8, status: 'overdue', currency: 'ARS' }),
    charge({ id: 'usd-debt', year: 2026, month: 7, status: 'overdue', currency: 'USD' }),
  ]

  const result = deriveMembershipDebtExperience({
    asOfDate: '2026-09-27',
    charges,
  })

  assert.equal(result.blockedForPriorDebt, true)
  assert.deepEqual(result.blockingChargeIds, ['ars-debt', 'usd-debt'])
  assert.deepEqual(
    result.charges.map((item) => ({ id: item.id, currency: item.currency })),
    [
      { id: 'ars-debt', currency: 'ARS' },
      { id: 'usd-debt', currency: 'USD' },
    ],
  )
  assert.equal('totalRemainingMinor' in result, false)
})
