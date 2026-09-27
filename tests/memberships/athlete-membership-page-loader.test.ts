import assert from 'node:assert/strict'
import test from 'node:test'

import { createAthleteMembershipPageLoader } from '../../lib/memberships/athlete-membership-page-loader'

test('production athlete membership loader composes Drizzle snapshot reading with presentation', async () => {
  const calls: string[] = []

  const load = createAthleteMembershipPageLoader({
    createPort: () => ({
      athleteBelongsToTeam: async (teamId, athleteId) => {
        calls.push(`belongs:${teamId}:${athleteId}`)
        return true
      },
      listBillingTerms: async (teamId, athleteId) => {
        calls.push(`terms:${teamId}:${athleteId}`)
        return [{
          id: 'terms-1',
          athleteId,
          monthlyAmountMinor: 2_500_000,
          currency: 'ARS',
          effectiveFrom: '2026-09-15',
          effectiveUntil: null,
        }]
      },
      listMonthlyCharges: async (teamId, athleteId) => {
        calls.push(`charges:${teamId}:${athleteId}`)
        return [{
          athleteId,
          billingTermsId: 'terms-1',
          year: 2026,
          month: 9,
          baseAmountMinor: 2_500_000,
          amountDueMinor: 2_500_000,
          currency: 'ARS',
          baseDueDate: '2026-09-15',
          effectiveDueDate: '2026-09-15',
        }]
      },
      listTeamEconomicPolicies: async () => [],
      insertMonthlyCharges: async () => {
        throw new Error('page load must not materialize charges')
      },
    }),
  })

  const model = await load({
    db: {},
    locale: 'es',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    onDate: '2026-09-25',
  })

  assert.equal(model.title, 'Membresía')
  assert.equal(model.currentTerms?.monthlyAmount, '$25.000')
  assert.equal(model.charges.length, 1)
  assert.equal(model.charges[0]?.amountDue, '$25.000')
  assert.equal(model.charges[0]?.period, '09/2026')
  assert.deepEqual(calls, [
    'belongs:team_1:athlete-1',
    'terms:team_1:athlete-1',
    'charges:team_1:athlete-1',
  ])
})


test('KAN-479 athlete membership loader preserves auditable H2 revision values', async () => {
  const load = createAthleteMembershipPageLoader({
    createPort: () => ({
      athleteBelongsToTeam: async () => true,
      listBillingTerms: async (_teamId, athleteId) => [{
        id: 'terms-1',
        athleteId,
        monthlyAmountMinor: 2_500_000,
        currency: 'ARS',
        effectiveFrom: '2026-09-15',
        effectiveUntil: null,
      }],
      listMonthlyCharges: async (_teamId, athleteId) => [{
        athleteId,
        billingTermsId: 'terms-1',
        year: 2026,
        month: 9,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_200_000,
        currency: 'ARS',
        baseDueDate: '2026-09-15',
        effectiveDueDate: '2026-09-29',
      }],
      listPersistedMonthlyCharges: async () => [{
        id: 'charge-1',
        athleteId: 'athlete-1',
        billingTermsId: 'terms-1',
        year: 2026,
        month: 9,
        baseAmountMinor: 2_500_000,
        amountDueMinor: 2_200_000,
        currency: 'ARS',
        baseDueDate: '2026-09-15',
        effectiveDueDate: '2026-09-29',
      }],
      listMonthlyChargeReductionRevisions: async () => [{
        id: 'reduction-1',
        monthlyChargeId: 'charge-1',
        reductionAmountMinor: 300_000,
        reason: 'Beca parcial',
        isCurrent: true,
      }],
      listMonthlyChargeExtensionRevisions: async () => [{
        id: 'extension-1',
        monthlyChargeId: 'charge-1',
        extendedDueDate: '2026-09-29',
        reason: 'Prórroga',
        isCurrent: true,
      }],
      listTeamEconomicPolicies: async () => [],
      insertMonthlyCharges: async () => undefined,
    }),
  })

  const model = await load({
    db: {},
    locale: 'es',
    teamId: 'team_1',
    athleteId: 'athlete-1',
    onDate: '2026-09-25',
  })

  assert.equal(model.reductionHistory[0]?.reductionAmountMinor, 300_000)
  assert.equal(model.extensionHistory[0]?.extendedDueDate, '2026-09-29')
})
