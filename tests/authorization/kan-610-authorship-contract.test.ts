import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6PaymentActions } from '@/lib/memberships/h6-payment-actions'

test('KAN-610/T1 payment writer receives the authenticated EPT actor, not only the active Team', async () => {
  const observed: unknown[] = []
  const actor = { status: 'authenticated' as const, userId: 'coach_a' }
  const actions = createH6PaymentActions({
    authenticate: async () => actor,
    authorize: async () => ({ allowed: true as const, teamId: 'team_a' }),
    ownsCharge: async () => true,
    ownsPayment: async () => true,
    register: async (...args) => {
      observed.push(args)
      return { success: true as const }
    },
    correct: async (...args) => {
      observed.push(args)
      return { success: true as const }
    },
    voidPayment: async (...args) => {
      observed.push(args)
      return { success: true as const }
    },
    revalidate: () => {},
    now: () => '2026-10-10T12:00:00.000Z',
  })
  const base = { athleteId: 'athlete_a', monthlyChargeId: 'charge_a', locale: 'es' as const }
  const pay = { ...base, amountMinor: 1000, paymentMethod: 'cash' as const, paidAt: '2026-10-10' }

  assert.equal((await actions.register(pay)).success, true)
  assert.equal((await actions.correct({ ...pay, paymentId: 'payment_a' })).success, true)
  assert.equal((await actions.voidPayment({ ...base, paymentId: 'payment_a' })).success, true)

  assert.equal(observed.length, 3)
  for (const args of observed) {
    assert.ok(
      args.some((value) => typeof value === 'object' && value !== null
        && 'authenticatedActorUserId' in value && value.authenticatedActorUserId === 'coach_a'
        && 'effectiveActorUserId' in value && value.effectiveActorUserId === 'coach_a'),
      'sensitive writer must receive trusted H2 authorship alongside its authorized Team',
    )
  }
})
