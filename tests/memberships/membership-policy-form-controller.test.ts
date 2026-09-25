import assert from 'node:assert/strict'
import test from 'node:test'

import { createTeamEconomicPolicyFormController } from '../../lib/memberships/membership-policy-form-controller'

test('submits valid form values through the policy action boundary', async () => {
  const calls: unknown[] = []
  const controller = createTeamEconomicPolicyFormController({
    submitAction: async (input) => {
      calls.push(input)
      return { success: true }
    },
  })

  const result = await controller.submit({
    monthlyAmount: '25000',
    currency: 'ARS',
    ordinaryDueDay: '5',
    effectiveFrom: '2026-11-01',
  })

  assert.deepEqual(calls, [{
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-11-01',
  }])
  assert.deepEqual(result, { success: true, error: null })
})

test('surfaces validation and Server Action errors without inventing success state', async () => {
  const controller = createTeamEconomicPolicyFormController({
    submitAction: async () => ({
      success: false,
      error: 'Policy replacement must start after current policy',
    }),
  })

  assert.deepEqual(
    await controller.submit({
      monthlyAmount: '25000.50',
      currency: 'ARS',
      ordinaryDueDay: '5',
      effectiveFrom: '2026-11-01',
    }),
    {
      success: false,
      error: 'Invalid team economic policy form input',
    },
  )

  assert.deepEqual(
    await controller.submit({
      monthlyAmount: '25000',
      currency: 'ARS',
      ordinaryDueDay: '5',
      effectiveFrom: '2026-11-01',
    }),
    {
      success: false,
      error: 'Policy replacement must start after current policy',
    },
  )
})
