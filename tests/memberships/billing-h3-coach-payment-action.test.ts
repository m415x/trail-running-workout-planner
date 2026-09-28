import assert from 'node:assert/strict'
import test from 'node:test'

import { createMembershipActionHandlers } from '../../lib/memberships/membership-action-handlers'

test('Coach manual Payment action delegates H3 semantics and revalidates athlete membership page', async () => {
  const calls: unknown[] = []
  const paths: string[] = []

  const handlers = createMembershipActionHandlers({
    teamId: 'team_1',
    runtime: {
      configureTeamEconomicPolicy: async () => ({ success: true }),
      applyInitialAthleteBillingTerms: async () => ({ success: true }),
      changeAthleteBillingTerms: async () => ({ success: true }),
      materializeTeamMonthlyCharges: async () => ({
        success: true,
        processedAthletes: 0,
        materializedCharges: 0,
      }),
      applyGlobalDueDateException: async () => ({ success: true }),
      applyMonthlyChargeReduction: async () => ({ success: true }),
      applyMonthlyChargeExtension: async () => ({ success: true }),
      registerManualPayment: async (input) => {
        calls.push(input)
        return { success: true }
      },
    },
    revalidatePath: (path) => {
      paths.push(path)
    },
  })

  const result = await handlers.registerManualPayment({
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-09-27',
    locale: 'en',
  })

  assert.deepEqual(result, { success: true })
  assert.deepEqual(calls, [{
    teamId: 'team_1',
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    amountMinor: 1_250_000,
    paymentMethod: 'bank_transfer',
    paidAt: '2026-09-27',
  }])
  assert.deepEqual(paths, ['/en/dashboard/athletes/athlete-1'])
})
