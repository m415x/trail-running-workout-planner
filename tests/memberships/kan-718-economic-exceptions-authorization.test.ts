import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6EconomicExceptionActions } from '@/lib/memberships/h6-economic-exception-actions'

const access = { status: 'authenticated' as const, userId: 'operator_a' }
const at = '2026-10-09T12:00:00.000Z'

function fixture(options: { allowed?: boolean; owned?: boolean; actor?: typeof access } = {}) {
  const writes: string[] = []
  const revalidations: string[] = []
  const requests: string[] = []
  const actions = createH6EconomicExceptionActions({
    authenticate: async () => options.actor ?? access,
    authorize: async (_access, request) => {
      requests.push(request.capability)
      return options.allowed === false ? { allowed: false as const } : { allowed: true as const, teamId: 'team_a' }
    },
    ownsCharge: async (teamId, athleteId, chargeId, year, month) =>
      options.owned !== false && teamId === 'team_a' && athleteId === 'athlete_a'
      && chargeId === 'charge_a' && year === 2026 && month === 9,
    globalDueDate: async (teamId) => { writes.push('global:' + teamId); return { success: true as const } },
    reduce: async (teamId) => { writes.push('reduction:' + teamId); return { success: true as const } },
    extend: async (teamId) => { writes.push('extension:' + teamId); return { success: true as const } },
    revalidate: (path) => { revalidations.push(path) },
    now: () => at,
  })
  const charge = { monthlyChargeId: 'charge_a', athleteId: 'athlete_a', year: 2026, month: 9, reason: 'Review', locale: 'es' as const }
  return { actions, writes, revalidations, requests, charge }
}

test('KAN-718 uses economy.manage and server Team for global exception, reduction and extension', async () => {
  const h = fixture()
  assert.equal((await h.actions.global({ year: 2026, month: 9, dueDate: '2026-10-15', reason: 'Review', locale: 'es' })).success, true)
  assert.equal((await h.actions.reduction({ ...h.charge, reductionAmountMinor: 1000 })).success, true)
  assert.equal((await h.actions.extension({ ...h.charge, extendedDueDate: '2026-10-20' })).success, true)
  assert.deepEqual(h.requests, ['economy.manage', 'economy.manage', 'economy.manage'])
  assert.deepEqual(h.writes, ['global:team_a', 'reduction:team_a', 'extension:team_a'])
  assert.equal(h.revalidations.length, 3)
})

test('KAN-718 DENY and mismatched persisted charge ownership have zero write/revalidate effects', async () => {
  const denied = fixture({ allowed: false })
  const foreign = fixture({ owned: false })
  for (const h of [denied, foreign]) {
    assert.equal((await h.actions.reduction({ ...h.charge, reductionAmountMinor: 1000 })).success, false)
    assert.equal((await h.actions.extension({ ...h.charge, extendedDueDate: null })).success, false)
    assert.deepEqual(h.writes, [])
    assert.deepEqual(h.revalidations, [])
  }
  assert.equal((await denied.actions.global({ year: 2026, month: 9, dueDate: '2026-10-15', reason: 'Review', locale: 'es' })).success, false)
  assert.deepEqual(denied.writes, [])
  assert.deepEqual(denied.revalidations, [])
})

test('KAN-844 wrong charge period denies reduction and extension before persistence', async () => {
  const h = fixture()
  assert.equal((await h.actions.reduction({ ...h.charge, month: 10, reductionAmountMinor: 1000 })).success, false)
  assert.equal((await h.actions.extension({ ...h.charge, year: 2025, extendedDueDate: null })).success, false)
  assert.deepEqual(h.writes, [])
  assert.deepEqual(h.revalidations, [])
})

test('KAN-844 anonymous H2 cannot invoke global, reduction or extension writers', async () => {
  let authorized = 0
  let writes = 0
  const actions = createH6EconomicExceptionActions({
    authenticate: async () => ({ status: 'forbidden' as const, reason: 'anonymous' as const }),
    authorize: async () => { authorized++; return { allowed: true as const, teamId: 'team_a' } },
    ownsCharge: async () => true,
    globalDueDate: async () => { writes++; return { success: true as const } },
    reduce: async () => { writes++; return { success: true as const } },
    extend: async () => { writes++; return { success: true as const } },
    revalidate: () => { throw new Error('DENY must not revalidate') },
    now: () => at,
  })
  const charge = { monthlyChargeId: 'charge_a', athleteId: 'athlete_a', year: 2026, month: 9, reason: 'Review', locale: 'es' as const }
  assert.equal((await actions.global({ year: 2026, month: 9, dueDate: '2026-10-15', reason: 'Review', locale: 'es' })).success, false)
  assert.equal((await actions.reduction({ ...charge, reductionAmountMinor: 1000 })).success, false)
  assert.equal((await actions.extension({ ...charge, extendedDueDate: null })).success, false)
  assert.equal(authorized, 0)
  assert.equal(writes, 0)
})
