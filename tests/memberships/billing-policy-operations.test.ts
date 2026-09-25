import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTeamEconomicPolicy,
  replaceTeamEconomicPolicy,
  type AthleteBillingTerms,
  type TeamEconomicPolicy,
} from '../../lib/memberships/billing'

const currentPolicy: TeamEconomicPolicy = {
  id: 'policy-a',
  teamId: 'team-a',
  defaultMonthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  ordinaryDueDay: 5,
  effectiveFrom: '2026-10-01',
  effectiveUntil: null,
}

const existingTerms: AthleteBillingTerms = {
  id: 'terms-a',
  athleteId: 'athlete-a',
  monthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  effectiveFrom: '2026-10-18',
  effectiveUntil: null,
}

test('team economic policy bootstrap starts on a monthly boundary', () => {
  const policy = createTeamEconomicPolicy({
    id: 'policy-a',
    teamId: 'team-a',
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-10-01',
  })

  assert.deepEqual(policy, currentPolicy)

  assert.throws(
    () => createTeamEconomicPolicy({
      id: 'policy-b',
      teamId: 'team-a',
      defaultMonthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-10-18',
    }),
    /monthly boundary/i,
  )
})

test('prospective team policy replacement closes the current policy and creates the next one', () => {
  const result = replaceTeamEconomicPolicy({
    current: currentPolicy,
    replacementId: 'policy-b',
    effectiveFrom: '2026-11-01',
    defaultMonthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    ordinaryDueDay: 10,
  })

  assert.equal(result.current.effectiveUntil, '2026-11-01')
  assert.deepEqual(result.replacement, {
    id: 'policy-b',
    teamId: 'team-a',
    defaultMonthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    ordinaryDueDay: 10,
    effectiveFrom: '2026-11-01',
    effectiveUntil: null,
  })
})

test('team default replacement does not mutate existing athlete billing terms', () => {
  const before = structuredClone(existingTerms)

  replaceTeamEconomicPolicy({
    current: currentPolicy,
    replacementId: 'policy-b',
    effectiveFrom: '2026-11-01',
    defaultMonthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    ordinaryDueDay: 10,
  })

  assert.deepEqual(existingTerms, before)
})

test('team policy replacement rejects intramonth and retroactive rewrites', () => {
  assert.throws(
    () => replaceTeamEconomicPolicy({
      current: currentPolicy,
      replacementId: 'policy-b',
      effectiveFrom: '2026-11-15',
      defaultMonthlyAmountMinor: 3_000_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
    }),
    /monthly boundary/i,
  )

  assert.throws(
    () => replaceTeamEconomicPolicy({
      current: currentPolicy,
      replacementId: 'policy-b',
      effectiveFrom: '2026-09-01',
      defaultMonthlyAmountMinor: 3_000_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
    }),
    /after the current policy/i,
  )
})
