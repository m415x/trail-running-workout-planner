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

test('KAN-610/T1 official Coach evidence cannot expose a caller-selected recorder user', async () => {
  const { createCoachTrack1000mEvidence } = await import('@/lib/physiology/field-performance-test-application')
  const inserted: Array<{ recordedByUserId?: string | null }> = []
  const result = await createCoachTrack1000mEvidence(
    {
      athleteId: 'athlete_a',
      coachUserId: 'spoofed_user',
      performedAt: '2026-10-10',
      elapsedTimeSec: 230,
      testEventId: 'event_a',
    },
    {
      resolveOwnedAthlete: async () => ({ id: 'athlete_a' }),
      resolveEligibleTestEvent: async () => ({ id: 'event_a' }),
      findActiveOfficialByAthleteAndTestEvent: () => undefined,
      insert: (row) => {
        inserted.push(row)
        return row as never
      },
      newId: () => 'evidence_a',
      now: () => '2026-10-10T12:00:00.000Z',
    },
  )
  assert.equal(result.success, true)
  assert.notEqual(
    inserted[0]?.recordedByUserId,
    'spoofed_user',
    'official recorder must never be selected by a request payload',
  )
})
