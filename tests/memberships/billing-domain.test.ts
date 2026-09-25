import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAthleteBillingTerms,
  createMonthlyChargeCandidate,
  replaceAthleteBillingTerms,
  type AthleteBillingTerms,
  type TeamEconomicPolicy,
} from '@/lib/memberships/billing'

const policy: TeamEconomicPolicy = {
  id: 'policy-ars-2026',
  teamId: 'team-1',
  defaultMonthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  ordinaryDueDay: 5,
  effectiveFrom: '2026-01-01',
  effectiveUntil: null,
}

test('billing terms snapshot policy defaults and are not mutated by later policy changes', () => {
  const terms = createAthleteBillingTerms({
    id: 'terms-1',
    athleteId: 'athlete-1',
    policy,
    effectiveFrom: '2026-10-18',
  })

  const changedPolicy = {
    ...policy,
    defaultMonthlyAmountMinor: 3_000_000,
  }

  assert.equal(terms.monthlyAmountMinor, 2_500_000)
  assert.equal(terms.currency, 'ARS')
  assert.equal(changedPolicy.defaultMonthlyAmountMinor, 3_000_000)
  assert.equal(terms.monthlyAmountMinor, 2_500_000)
})

test('a mid-month initial economic enrollment claims the full month', () => {
  const terms = createAthleteBillingTerms({
    id: 'terms-1',
    athleteId: 'athlete-1',
    policy,
    effectiveFrom: '2026-10-18',
  })

  const charge = createMonthlyChargeCandidate({
    terms: [terms],
    policy,
    year: 2026,
    month: 10,
  })

  assert.deepEqual(charge, {
    athleteId: 'athlete-1',
    billingTermsId: 'terms-1',
    year: 2026,
    month: 10,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_500_000,
    currency: 'ARS',
    baseDueDate: '2026-10-05',
    effectiveDueDate: '2026-10-05',
  })
})

test('a mid-month economic end still claims the full final month', () => {
  const terms: AthleteBillingTerms = {
    id: 'terms-1',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-01-01',
    effectiveUntil: '2026-10-18',
  }

  const charge = createMonthlyChargeCandidate({
    terms: [terms],
    policy,
    year: 2026,
    month: 10,
  })

  assert.equal(charge?.billingTermsId, 'terms-1')
  assert.equal(charge?.amountDueMinor, 2_500_000)
})

test('an ordinary terms replacement must start on a monthly boundary', () => {
  const current: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }

  assert.throws(
    () =>
      replaceAthleteBillingTerms({
        current,
        replacementId: 'terms-b',
        effectiveFrom: '2026-12-15',
        monthlyAmountMinor: 3_000_000,
        currency: 'ARS',
      }),
    /monthly boundary/i,
  )
})

test('two terms cannot claim the same athlete calendar month even without interval overlap', () => {
  const termsA: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-01',
    effectiveUntil: '2026-10-15',
  }
  const termsB: AthleteBillingTerms = {
    id: 'terms-b',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-15',
    effectiveUntil: null,
  }

  assert.throws(
    () =>
      createMonthlyChargeCandidate({
        terms: [termsA, termsB],
        policy,
        year: 2026,
        month: 10,
      }),
    /more than one billing terms.*month/i,
  )
})
