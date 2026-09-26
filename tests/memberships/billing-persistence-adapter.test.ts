import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createBillingPersistenceAdapter,
  type BillingPersistencePort,
} from '../../lib/memberships/billing-persistence'

test('billing persistence adapter scopes athlete reads to team and maps H1 records', async () => {
  const calls: Array<[string, string, string?]> = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async (teamId, athleteId) => {
      calls.push(['belongs', teamId, athleteId])
      return true
    },
    listBillingTerms: async (teamId, athleteId) => {
      calls.push(['terms', teamId, athleteId])
      return []
    },
    listMonthlyCharges: async (teamId, athleteId) => {
      calls.push(['charges', teamId, athleteId])
      return []
    },
    listTeamEconomicPolicies: async (teamId) => {
      calls.push(['policies', teamId])
      return []
    },
    insertMonthlyCharges: async () => {},
  }

  const adapter = createBillingPersistenceAdapter(port)
  const snapshot = await adapter.getAthleteBillingSnapshot({
    teamId: 'team-a',
    athleteId: 'athlete-a',
  })

  assert.deepEqual(snapshot, { terms: [], charges: [] })
  assert.deepEqual(calls, [
    ['belongs', 'team-a', 'athlete-a'],
    ['terms', 'team-a', 'athlete-a'],
    ['charges', 'team-a', 'athlete-a'],
  ])
})

test('billing persistence adapter rejects cross-team reads before economic queries', async () => {
  const calls: string[] = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async () => {
      calls.push('belongs')
      return false
    },
    listBillingTerms: async () => {
      calls.push('terms')
      return []
    },
    listMonthlyCharges: async () => {
      calls.push('charges')
      return []
    },
    listTeamEconomicPolicies: async () => [],
    insertMonthlyCharges: async () => {},
  }

  const adapter = createBillingPersistenceAdapter(port)

  await assert.rejects(
    () => adapter.getAthleteBillingSnapshot({ teamId: 'team-b', athleteId: 'athlete-a' }),
    /athlete.*team/i,
  )
  assert.deepEqual(calls, ['belongs'])
})

test('billing persistence adapter materializes with team-scoped policies and athlete data', async () => {
  const calls: string[] = []
  const port: BillingPersistencePort = {
    athleteBelongsToTeam: async (teamId, athleteId) =>
      teamId === 'team-a' && athleteId === 'athlete-a',
    listBillingTerms: async () => [{
      id: 'terms-a',
      athleteId: 'athlete-a',
      monthlyAmountMinor: 2_500_000,
      currency: 'ARS',
      effectiveFrom: '2026-10-18',
      effectiveUntil: null,
    }],
    listMonthlyCharges: async () => [],
    listTeamEconomicPolicies: async (teamId) => {
      calls.push(`policies:${teamId}`)
      return [{
        id: 'policy-a',
        teamId,
        defaultMonthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        ordinaryDueDay: 5,
        effectiveFrom: '2026-10-01',
        effectiveUntil: null,
      }]
    },
    insertMonthlyCharges: async (teamId, athleteId, charges) => {
      calls.push(`insert:${teamId}:${athleteId}:${charges.length}`)
    },
  }

  const adapter = createBillingPersistenceAdapter(port)
  const result = await adapter.materializeMonthlyCharges({
    teamId: 'team-a',
    athleteId: 'athlete-a',
    through: { year: 2026, month: 10 },
  })

  assert.equal(result.length, 1)
  assert.deepEqual(calls, ['policies:team-a', 'insert:team-a:athlete-a:1'])
})
