import assert from 'node:assert/strict'
import test from 'node:test'

import {
  materializeMonthlyCharges,
  type AthleteBillingTerms,
  type MonthlyChargeCandidate,
  type TeamEconomicPolicy,
} from '../../lib/memberships/billing'

const terms: AthleteBillingTerms[] = [{
  id: 'terms-a',
  athleteId: 'athlete-a',
  monthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  effectiveFrom: '2026-10-18',
  effectiveUntil: null,
}]

const policies: TeamEconomicPolicy[] = [{
  id: 'policy-a',
  teamId: 'team-a',
  defaultMonthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  ordinaryDueDay: 5,
  effectiveFrom: '2026-10-01',
  effectiveUntil: null,
}]

test('monthly materialization loads state and persists only missing charge snapshots', async () => {
  const existing: MonthlyChargeCandidate[] = [{
    athleteId: 'athlete-a',
    billingTermsId: 'terms-a',
    year: 2026,
    month: 10,
    baseAmountMinor: 2_500_000,
    amountDueMinor: 2_500_000,
    currency: 'ARS',
    baseDueDate: '2026-10-18',
    effectiveDueDate: '2026-10-18',
  }]
  const inserted: MonthlyChargeCandidate[] = []

  const result = await materializeMonthlyCharges({
    athleteId: 'athlete-a',
    through: { year: 2026, month: 12 },
    repository: {
      getBillingTerms: async () => terms,
      getTeamEconomicPolicies: async () => policies,
      getMonthlyCharges: async () => existing,
      insertMonthlyCharges: async (charges) => {
        inserted.push(...charges)
      },
    },
  })

  assert.deepEqual(inserted.map(charge => charge.month), [11, 12])
  assert.deepEqual(result.map(charge => charge.month), [10, 11, 12])
})

test('repeating monthly materialization does not persist existing snapshots again', async () => {
  const stored: MonthlyChargeCandidate[] = []

  const repository = {
    getBillingTerms: async () => terms,
    getTeamEconomicPolicies: async () => policies,
    getMonthlyCharges: async () => [...stored],
    insertMonthlyCharges: async (charges: MonthlyChargeCandidate[]) => {
      stored.push(...charges)
    },
  }

  await materializeMonthlyCharges({
    athleteId: 'athlete-a',
    through: { year: 2026, month: 11 },
    repository,
  })
  await materializeMonthlyCharges({
    athleteId: 'athlete-a',
    through: { year: 2026, month: 11 },
    repository,
  })

  assert.deepEqual(stored.map(charge => charge.month), [10, 11])
})

test('monthly materialization is an application operation independent of UI navigation', async () => {
  const calls: string[] = []

  await materializeMonthlyCharges({
    athleteId: 'athlete-a',
    through: { year: 2026, month: 10 },
    repository: {
      getBillingTerms: async (athleteId) => {
        calls.push(`terms:${athleteId}`)
        return terms
      },
      getTeamEconomicPolicies: async (athleteId) => {
        calls.push(`policies:${athleteId}`)
        return policies
      },
      getMonthlyCharges: async (athleteId) => {
        calls.push(`charges:${athleteId}`)
        return []
      },
      insertMonthlyCharges: async (charges) => {
        calls.push(`insert:${charges.length}`)
      },
    },
  })

  assert.deepEqual(calls, [
    'terms:athlete-a',
    'policies:athlete-a',
    'charges:athlete-a',
    'insert:1',
  ])
})
