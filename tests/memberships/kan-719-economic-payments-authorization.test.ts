import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6PaymentActions } from '@/lib/memberships/h6-payment-actions'

const auth = { status: 'authenticated' as const, userId: 'coach_a' }
const base = { athleteId: 'athlete_a', monthlyChargeId: 'charge_a', locale: 'es' as const }
const paid = { ...base, amountMinor: 120000, paymentMethod: 'cash' as const, paidAt: '2026-10-09' }
const amended = { ...paid, paymentId: 'payment_a' }
const voided = { ...base, paymentId: 'payment_a' }

function harness(options: { allowed?: boolean; owned?: boolean; ownsPayment?: boolean } = {}) {
  const writes: string[] = []
  const revalidations: string[] = []
  const capabilities: string[] = []
  const actions = createH6PaymentActions({
    authenticate: async () => auth,
    authorize: async (_access, request) => {
      capabilities.push(request.capability)
      return options.allowed === false ? { allowed: false as const } : { allowed: true as const, teamId: 'team_a' }
    },
    ownsCharge: async (teamId, athleteId, chargeId) =>
      options.owned !== false && teamId === 'team_a' && athleteId === 'athlete_a' && chargeId === 'charge_a',
    ownsPayment: async (_teamId, _athleteId, _chargeId, paymentId) =>
      options.ownsPayment !== false && paymentId === 'payment_a',
    register: async (teamId) => { writes.push('register:' + teamId); return { success: true as const } },
    correct: async (teamId) => { writes.push('correct:' + teamId); return { success: true as const } },
    voidPayment: async (teamId) => { writes.push('void:' + teamId); return { success: true as const } },
    revalidate: (path) => { revalidations.push(path) },
    now: () => '2026-10-09T12:00:00.000Z',
  })
  return { actions, writes, revalidations, capabilities }
}

test('KAN-719 permits payment register/correct/void only through economy.manage and owned resources', async () => {
  const h = harness()
  assert.equal((await h.actions.register(paid)).success, true)
  assert.equal((await h.actions.correct(amended)).success, true)
  assert.equal((await h.actions.voidPayment(voided)).success, true)
  assert.deepEqual(h.capabilities, ['economy.manage', 'economy.manage', 'economy.manage'])
  assert.deepEqual(h.writes, ['register:team_a', 'correct:team_a', 'void:team_a'])
  assert.equal(h.revalidations.length, 3)
})

test('KAN-719 authorization, charge and payment ownership DENY without revisions or post-write effects', async () => {
  for (const options of [{ allowed: false }, { owned: false }, { ownsPayment: false }]) {
    const h = harness(options)
    if (options.ownsPayment === false) {
      assert.equal((await h.actions.correct(amended)).success, false)
      assert.equal((await h.actions.voidPayment(voided)).success, false)
    } else {
      assert.equal((await h.actions.register(paid)).success, false)
      assert.equal((await h.actions.correct(amended)).success, false)
      assert.equal((await h.actions.voidPayment(voided)).success, false)
    }
    assert.deepEqual(h.writes, [])
    assert.deepEqual(h.revalidations, [])
  }
})

test('KAN-844 anonymous H2 denies payment register, correct and void before authorization or write', async () => {
  let authorized = 0
  let writes = 0
  const actions = createH6PaymentActions({
    authenticate: async () => ({ status: 'forbidden' as const, reason: 'anonymous' as const }),
    authorize: async () => { authorized++; return { allowed: true as const, teamId: 'team_a' } },
    ownsCharge: async () => true,
    ownsPayment: async () => true,
    register: async () => { writes++; return { success: true as const } },
    correct: async () => { writes++; return { success: true as const } },
    voidPayment: async () => { writes++; return { success: true as const } },
    revalidate: () => { throw new Error('DENY must not revalidate') },
    now: () => '2026-10-09T12:00:00.000Z',
  })
  assert.equal((await actions.register(paid)).success, false)
  assert.equal((await actions.correct(amended)).success, false)
  assert.equal((await actions.voidPayment(voided)).success, false)
  assert.equal(authorized, 0)
  assert.equal(writes, 0)
})
