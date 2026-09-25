import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createAthleteBillingTermsService,
  type AthleteBillingTermsRepository,
} from '../../lib/memberships/athlete-billing-terms-service'

const policy = {
  id: 'policy-a',
  teamId: 'team-a',
  defaultMonthlyAmountMinor: 2_500_000,
  currency: 'ARS',
  ordinaryDueDay: 5,
  effectiveFrom: '2026-10-01',
  effectiveUntil: null,
}

test('Coach applies initial athlete billing terms from the effective team policy', async () => {
  const saved: string[] = []
  const repository: AthleteBillingTermsRepository = {
    athleteBelongsToTeam: async () => true,
    listTeamEconomicPolicies: async () => [policy],
    listAthleteBillingTerms: async () => [],
    saveAthleteBillingTerms: async (terms) => saved.push(`${terms.id}:${terms.monthlyAmountMinor}`),
    replaceAthleteBillingTerms: async () => {
      throw new Error('unexpected replacement')
    },
  }

  const service = createAthleteBillingTermsService(repository)
  const terms = await service.applyInitialTerms({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    termsId: 'terms-a',
    effectiveFrom: '2026-10-18',
  })

  assert.equal(terms.monthlyAmountMinor, 2_500_000)
  assert.deepEqual(saved, ['terms-a:2500000'])
})

test('Coach changes athlete billing terms prospectively without rewriting current terms', async () => {
  const current = {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-18',
    effectiveUntil: null,
  }
  const writes: string[] = []
  const repository: AthleteBillingTermsRepository = {
    athleteBelongsToTeam: async () => true,
    listTeamEconomicPolicies: async () => [policy],
    listAthleteBillingTerms: async () => [current],
    saveAthleteBillingTerms: async () => {
      throw new Error('unexpected bootstrap')
    },
    replaceAthleteBillingTerms: async (closed, replacement) => {
      writes.push(`close:${closed.id}:${closed.effectiveUntil}`)
      writes.push(`create:${replacement.id}:${replacement.monthlyAmountMinor}`)
    },
  }

  const service = createAthleteBillingTermsService(repository)
  const terms = await service.changeTerms({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    termsId: 'terms-b',
    effectiveFrom: '2026-11-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
  })

  assert.equal(terms.id, 'terms-b')
  assert.deepEqual(writes, [
    'close:terms-a:2026-11-01',
    'create:terms-b:3000000',
  ])
})

test('Coach rejects athlete terms operations outside the requested team', async () => {
  const repository: AthleteBillingTermsRepository = {
    athleteBelongsToTeam: async () => false,
    listTeamEconomicPolicies: async () => {
      throw new Error('economic data must not be read')
    },
    listAthleteBillingTerms: async () => {
      throw new Error('economic data must not be read')
    },
    saveAthleteBillingTerms: async () => {},
    replaceAthleteBillingTerms: async () => {},
  }

  const service = createAthleteBillingTermsService(repository)

  await assert.rejects(
    () => service.applyInitialTerms({
      teamId: 'team-b',
      athleteId: 'athlete-a',
      termsId: 'terms-a',
      effectiveFrom: '2026-10-18',
    }),
    /athlete.*team/i,
  )
})

test('Coach rejects ambiguous open athlete billing terms', async () => {
  const open = {
    id: 'terms-a',
    athleteId: 'athlete-a',
    monthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    effectiveFrom: '2026-10-01',
    effectiveUntil: null,
  }
  const repository: AthleteBillingTermsRepository = {
    athleteBelongsToTeam: async () => true,
    listTeamEconomicPolicies: async () => [policy],
    listAthleteBillingTerms: async () => [open, { ...open, id: 'terms-b' }],
    saveAthleteBillingTerms: async () => {},
    replaceAthleteBillingTerms: async () => {},
  }

  const service = createAthleteBillingTermsService(repository)

  await assert.rejects(
    () => service.changeTerms({
      teamId: 'team-a',
      athleteId: 'athlete-a',
      termsId: 'terms-c',
      effectiveFrom: '2026-11-01',
      monthlyAmountMinor: 3_000_000,
      currency: 'ARS',
    }),
    /terms.*ambiguous/i,
  )
})
