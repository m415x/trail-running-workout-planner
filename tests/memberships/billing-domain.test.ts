import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createAthleteBillingTerms,
  createMonthlyChargeCandidate,
  materializeMonthlyChargesThrough,
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
    baseDueDate: '2026-10-18',
    effectiveDueDate: '2026-10-18',
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


test('monthly materialization through a target month is idempotent and preserves existing snapshots', () => {
  const terms: AthleteBillingTerms = {
    id: 'terms-1',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }

  const first = materializeMonthlyChargesThrough({
    terms: [terms],
    policies: [policy],
    existingCharges: [],
    through: { year: 2026, month: 12 },
  })

  assert.deepEqual(
    first.map((charge) => [charge.year, charge.month, charge.billingTermsId, charge.amountDueMinor]),
    [
      [2026, 10, 'terms-1', 2_500_000],
      [2026, 11, 'terms-1', 2_500_000],
      [2026, 12, 'terms-1', 2_500_000],
    ],
  )

  const existingOctober = {
    ...first[0]!,
    baseAmountMinor: 2_400_000,
    amountDueMinor: 2_400_000,
  }

  const repeated = materializeMonthlyChargesThrough({
    terms: [{ ...terms, monthlyAmountMinor: 3_000_000 }],
    policies: [policy],
    existingCharges: [existingOctober, first[1]!, first[2]!],
    through: { year: 2026, month: 12 },
  })

  assert.deepEqual(repeated, [existingOctober, first[1], first[2]])
})

test('monthly materialization assigns a monthly-boundary replacement to the correct months', () => {
  const current: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: '2026-12-01',
  }
  const replacement: AthleteBillingTerms = {
    id: 'terms-b',
    athleteId: 'athlete-1',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    effectiveFrom: '2026-12-01',
    effectiveUntil: null,
  }

  const charges = materializeMonthlyChargesThrough({
    terms: [current, replacement],
    policies: [policy],
    existingCharges: [],
    through: { year: 2027, month: 1 },
  })

  assert.deepEqual(
    charges.map((charge) => [charge.year, charge.month, charge.billingTermsId, charge.amountDueMinor]),
    [
      [2026, 10, 'terms-a', 2_500_000],
      [2026, 11, 'terms-a', 2_500_000],
      [2026, 12, 'terms-b', 3_000_000],
      [2027, 1, 'terms-b', 3_000_000],
    ],
  )
})


test('only the first reached month moves an already-passed ordinary due date to economic activation', () => {
  const terms = createAthleteBillingTerms({
    id: 'terms-1',
    athleteId: 'athlete-1',
    policy,
    effectiveFrom: '2026-10-18',
  })

  const charges = materializeMonthlyChargesThrough({
    terms: [terms],
    policies: [policy],
    existingCharges: [],
    through: { year: 2026, month: 11 },
  })

  assert.deepEqual(
    charges.map((charge) => [charge.year, charge.month, charge.baseDueDate, charge.effectiveDueDate]),
    [
      [2026, 10, '2026-10-18', '2026-10-18'],
      [2026, 11, '2026-11-05', '2026-11-05'],
    ],
  )
})
