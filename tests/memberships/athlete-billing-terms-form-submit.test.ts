import assert from 'node:assert/strict'
import test from 'node:test'

import { submitAthleteBillingTermsForm } from '../../lib/memberships/athlete-billing-terms-form-submit'

test('initial terms accept any valid calendar date and delegate without amount', async () => {
  let received: unknown = null

  const result = await submitAthleteBillingTermsForm({
    mode: 'initial',
    athleteId: 'athlete-1',
    locale: 'es',
    effectiveFrom: '2026-09-15',
    applyInitial: async (input) => {
      received = input
      return { success: true as const }
    },
    changeTerms: async () => {
      throw new Error('replacement action must not run')
    },
  })

  assert.deepEqual(received, {
    athleteId: 'athlete-1',
    effectiveFrom: '2026-09-15',
    locale: 'es',
  })
  assert.equal(result.success, true)
})

test('replacement converts whole pesos to minor units and requires first day of month', async () => {
  let received: unknown = null

  const result = await submitAthleteBillingTermsForm({
    mode: 'replacement',
    athleteId: 'athlete-1',
    locale: 'en',
    effectiveFrom: '2026-10-01',
    monthlyAmount: '30000',
    currency: 'ARS',
    applyInitial: async () => {
      throw new Error('initial action must not run')
    },
    changeTerms: async (input) => {
      received = input
      return { success: true as const }
    },
  })

  assert.deepEqual(received, {
    athleteId: 'athlete-1',
    effectiveFrom: '2026-10-01',
    monthlyAmountMinor: 3_000_000,
    currency: 'ARS',
    locale: 'en',
  })
  assert.equal(result.success, true)
})

test('invalid replacement date is rejected before invoking an action', async () => {
  let calls = 0

  const result = await submitAthleteBillingTermsForm({
    mode: 'replacement',
    athleteId: 'athlete-1',
    locale: 'es',
    effectiveFrom: '2026-10-15',
    monthlyAmount: '30000',
    currency: 'ARS',
    applyInitial: async () => {
      calls += 1
      return { success: true as const }
    },
    changeTerms: async () => {
      calls += 1
      return { success: true as const }
    },
  })

  assert.equal(result.success, false)
  assert.equal(calls, 0)
})

test('invalid initial calendar date is rejected before invoking an action', async () => {
  let calls = 0

  const result = await submitAthleteBillingTermsForm({
    mode: 'initial',
    athleteId: 'athlete-1',
    locale: 'es',
    effectiveFrom: '2026-02-30',
    applyInitial: async () => {
      calls += 1
      return { success: true as const }
    },
    changeTerms: async () => {
      calls += 1
      return { success: true as const }
    },
  })

  assert.equal(result.success, false)
  assert.equal(calls, 0)
})
