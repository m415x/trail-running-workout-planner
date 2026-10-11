import assert from 'node:assert/strict'
import test from 'node:test'
import { createH6PaymentActions } from '@/lib/memberships/h6-payment-actions'

test('KAN-727 H6 multiteam binding and DENY never reach a writer', async () => {
  const writes: Array<{ teamId: string; authenticatedActorUserId: string; effectiveActorUserId: string }> = []
  let selectedTeam: string | null = 'team_b'
  let allowed = true
  const actions = createH6PaymentActions({
    authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach_a' }),
    authorize: async () => ({ allowed, teamId: selectedTeam ?? undefined }),
    ownsCharge: async (teamId) => teamId === 'team_b',
    ownsPayment: async () => true,
    register: async (teamId, _input, actor) => {
      writes.push({ teamId, ...actor })
      return { success: true as const }
    },
    correct: async () => ({ success: true as const }),
    voidPayment: async () => ({ success: true as const }),
    revalidate: () => {},
    now: () => '2026-10-10T15:00:00.000Z',
  })
  const input = { athleteId: 'athlete_b', monthlyChargeId: 'charge_b', locale: 'es' as const, amountMinor: 1000, paymentMethod: 'cash' as const, paidAt: '2026-10-10', teamId: 'team_a', authenticatedActorUserId: 'spoofed' }
  assert.equal((await actions.register(input)).success, true)
  assert.deepEqual(writes, [{ teamId: 'team_b', authenticatedActorUserId: 'coach_a', effectiveActorUserId: 'coach_a' }])

  allowed = false
  assert.equal((await actions.register(input)).success, false)
  selectedTeam = null
  allowed = true
  assert.equal((await actions.register(input)).success, false)
  assert.equal(writes.length, 1, 'DENY and missing active Team must never reach write callback')
})
