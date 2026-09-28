import assert from 'node:assert/strict'
import test from 'node:test'

import { createMembershipActionHandlers } from '../../lib/memberships/membership-action-handlers'

test('Coach Payment correction and void actions preserve H3 scope and revalidate athlete page', async () => {
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
      registerManualPayment: async () => ({ success: true }),
      correctManualPayment: async (input) => {
        calls.push(['correct', input])
        return { success: true }
      },
      voidManualPayment: async (input) => {
        calls.push(['void', input])
        return { success: true }
      },
    },
    revalidatePath: (path) => paths.push(path),
  })

  assert.deepEqual(await handlers.correctManualPayment({
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    paymentId: 'payment-1',
    amountMinor: 900_000,
    paymentMethod: 'cash',
    paidAt: '2026-09-28',
    locale: 'es',
  }), { success: true })

  assert.deepEqual(await handlers.voidManualPayment({
    athleteId: 'athlete-1',
    monthlyChargeId: 'charge-1',
    paymentId: 'payment-1',
    locale: 'en',
  }), { success: true })

  assert.deepEqual(calls, [
    ['correct', {
      teamId: 'team_1',
      athleteId: 'athlete-1',
      monthlyChargeId: 'charge-1',
      paymentId: 'payment-1',
      amountMinor: 900_000,
      paymentMethod: 'cash',
      paidAt: '2026-09-28',
    }],
    ['void', {
      teamId: 'team_1',
      athleteId: 'athlete-1',
      monthlyChargeId: 'charge-1',
      paymentId: 'payment-1',
    }],
  ])
  assert.deepEqual(paths, [
    '/dashboard/athletes/athlete-1',
    '/en/dashboard/athletes/athlete-1',
  ])
})
