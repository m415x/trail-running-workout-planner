import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAthleteBillingSnapshot,
  type AthleteBillingTerms,
  type MonthlyChargeCandidate,
} from '../../lib/memberships/billing'

const terms: AthleteBillingTerms[] = [{
  id: 'terms-a',
  athleteId: 'athlete-a',
  monthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  effectiveFrom: '2026-10-18',
  effectiveUntil: null,
}]

const charges: MonthlyChargeCandidate[] = [{
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

test('billing snapshot returns terms and charges only when athlete belongs to requested team', async () => {
  const result = await getAthleteBillingSnapshot({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    repository: {
      athleteBelongsToTeam: async (teamId, athleteId) =>
        teamId === 'team-a' && athleteId === 'athlete-a',
      getBillingTerms: async () => terms,
      getMonthlyCharges: async () => charges,
    },
  })

  assert.deepEqual(result, { terms, charges })
})

test('billing snapshot rejects cross-team athlete access before loading economic data', async () => {
  const calls: string[] = []

  await assert.rejects(
    () => getAthleteBillingSnapshot({
      teamId: 'team-b',
      athleteId: 'athlete-a',
      repository: {
        athleteBelongsToTeam: async () => {
          calls.push('membership')
          return false
        },
        getBillingTerms: async () => {
          calls.push('terms')
          return terms
        },
        getMonthlyCharges: async () => {
          calls.push('charges')
          return charges
        },
      },
    }),
    /athlete.*team/i,
  )

  assert.deepEqual(calls, ['membership'])
})

test('billing snapshot keeps team isolation in the application boundary without defining auth rules', async () => {
  const requested: Array<[string, string]> = []

  await getAthleteBillingSnapshot({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    repository: {
      athleteBelongsToTeam: async (teamId, athleteId) => {
        requested.push([teamId, athleteId])
        return true
      },
      getBillingTerms: async (athleteId) => {
        assert.equal(athleteId, 'athlete-a')
        return terms
      },
      getMonthlyCharges: async (athleteId) => {
        assert.equal(athleteId, 'athlete-a')
        return charges
      },
    },
  })

  assert.deepEqual(requested, [['team-a', 'athlete-a']])
})
