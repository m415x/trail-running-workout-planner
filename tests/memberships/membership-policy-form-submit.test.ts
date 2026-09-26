import assert from 'node:assert/strict'
import test from 'node:test'

import { submitTeamEconomicPolicyForm } from '../../lib/memberships/membership-policy-form-submit'

test('converts whole peso form input to minor units before calling the Server Action', async () => {
  let received: unknown

  const result = await submitTeamEconomicPolicyForm({
    input: {
      monthlyAmount: '25000',
      currency: 'ARS',
      ordinaryDueDay: '5',
      effectiveFrom: '2026-11-01',
    },
    submit: async (input) => {
      received = input
      return { success: true }
    },
  })

  assert.deepEqual(received, {
    defaultMonthlyAmountMinor: 2_500_000,
    currency: 'ARS',
    ordinaryDueDay: 5,
    effectiveFrom: '2026-11-01',
  })
  assert.deepEqual(result, { success: true })
})

test('rejects invalid form values before calling the Server Action', async () => {
  let calls = 0

  const result = await submitTeamEconomicPolicyForm({
    input: {
      monthlyAmount: '25000.50',
      currency: 'ARS',
      ordinaryDueDay: '32',
      effectiveFrom: '2026-11-15',
    },
    submit: async () => {
      calls += 1
      return { success: true }
    },
  })

  assert.equal(calls, 0)
  assert.deepEqual(result, {
    success: false,
    error: 'Invalid team economic policy form input',
  })
})
