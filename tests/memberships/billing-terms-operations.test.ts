import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyAthleteBillingTerms,
  changeAthleteBillingTerms,
  type AthleteBillingTerms,
  type TeamEconomicPolicy,
} from '../../lib/memberships/billing'

const policy: TeamEconomicPolicy = {
  id: 'policy-a',
  teamId: 'team-a',
  defaultMonthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  ordinaryDueDay: 5,
  effectiveFrom: '2026-10-01',
  effectiveUntil: null,
}

test('initial athlete billing terms may start mid-month from the effective team policy defaults', () => {
  const terms = applyAthleteBillingTerms({
    id: 'terms-a',
    athleteId: 'athlete-a',
    policy,
    effectiveFrom: '2026-10-18',
  })

  assert.deepEqual(terms, {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  })
})

test('changing athlete billing terms is explicit and prospective at a monthly boundary', () => {
  const current: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }

  const result = changeAthleteBillingTerms({
    current,
    replacementId: 'terms-b',
    effectiveFrom: '2026-12-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  })

  assert.equal(result.current.effectiveUntil, '2026-12-01')
  assert.equal(result.replacement.monthlyAmountMinor, 3_000_000)
  assert.equal(result.replacement.effectiveFrom, '2026-12-01')
})

test('changing the team default is not an athlete terms operation', () => {
  const current: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }
  const before = structuredClone(current)

  const changed = changeAthleteBillingTerms({
    current,
    replacementId: 'terms-b',
    effectiveFrom: '2026-12-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  })

  assert.deepEqual(current, before)
  assert.notEqual(changed.replacement.id, current.id)
})

test('athlete terms replacement rejects retroactive and intramonth rewrites', () => {
  const current: AthleteBillingTerms = {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }

  assert.throws(
    () => changeAthleteBillingTerms({
      current,
      replacementId: 'terms-b',
      effectiveFrom: '2026-11-15',
      monthlyAmountMinor: 3_000_000,
      currency: 'ARS',
    }),
    /monthly boundary/i,
  )

  assert.throws(
    () => changeAthleteBillingTerms({
      current,
      replacementId: 'terms-b',
      effectiveFrom: '2026-10-01',
      monthlyAmountMinor: 3_000_000,
      currency: 'ARS',
    }),
    /after the current terms/i,
  )
})
