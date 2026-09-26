import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSynchronousAthleteBillingTermsService,
  type SynchronousAthleteBillingTermsRepository,
} from '../../lib/memberships/athlete-billing-terms-service'

test('synchronous athlete billing service applies initial terms from team policy', () => {
  const saved: string[] = []
  const repository: SynchronousAthleteBillingTermsRepository = {
    athleteBelongsToTeam: () => true,
    listTeamEconomicPolicies: () => [{
      id: 'policy-a',
      teamId: 'team-a',
      defaultMonthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      ordinaryDueDay: 5,
      effectiveFrom: '2026-10-01',
      effectiveUntil: null,
    }],
    listAthleteBillingTerms: () => [],
    saveAthleteBillingTerms: (terms) => {
      saved.push(terms.id)
    },
    replaceAthleteBillingTerms: () => {
      throw new Error('unexpected replacement')
    },
  }

  const service = createSynchronousAthleteBillingTermsService(repository)
  const terms = service.applyInitialTerms({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    termsId: 'terms-a',
    effectiveFrom: '2026-10-18',
  })

  assert.equal(terms.monthlyAmountMinor, 2_500_000)
  assert.deepEqual(saved, ['terms-a'])
})

test('synchronous athlete billing service changes open terms prospectively', () => {
  const replacements: string[] = []
  const repository: SynchronousAthleteBillingTermsRepository = {
    athleteBelongsToTeam: () => true,
    listTeamEconomicPolicies: () => [],
    listAthleteBillingTerms: () => [{
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-10-18',
      effectiveUntil: null,
    }],
    saveAthleteBillingTerms: () => {},
    replaceAthleteBillingTerms: (current, replacement) => {
      replacements.push(`${current.effectiveUntil}:${replacement.id}`)
    },
  }

  const service = createSynchronousAthleteBillingTermsService(repository)
  const terms = service.changeTerms({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    termsId: 'terms-b',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  })

  assert.equal(terms.monthlyAmountMinor, 3_000_000)
  assert.deepEqual(replacements, ['2026-11-01:terms-b'])
})

test('synchronous athlete billing service rejects cross-team access before economic reads', () => {
  let economicReads = 0
  const repository: SynchronousAthleteBillingTermsRepository = {
    athleteBelongsToTeam: () => false,
    listTeamEconomicPolicies: () => {
      economicReads += 1
      return []
    },
    listAthleteBillingTerms: () => {
      economicReads += 1
      return []
    },
    saveAthleteBillingTerms: () => {},
    replaceAthleteBillingTerms: () => {},
  }

  const service = createSynchronousAthleteBillingTermsService(repository)

  assert.throws(
    () => service.applyInitialTerms({
      teamId: 'team-a',
      athleteId: 'athlete-b',
      termsId: 'terms-a',
      effectiveFrom: '2026-10-18',
    }),
    /Athlete does not belong to the requested team/,
  )
  assert.equal(economicReads, 0)
})
