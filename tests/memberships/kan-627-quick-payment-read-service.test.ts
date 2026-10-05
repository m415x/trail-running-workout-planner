import assert from 'node:assert/strict'
import test from 'node:test'

import { createQuickPaymentReadService } from '../../lib/memberships/quick-payment-read-service'

const teamId = 'team-a'
const a = { athleteId: 'athlete-a', charges: [{ id: 'oct-a', year: 2026, month: 10, currency: 'ARS', remainingMinor: 5000, status: 'pending' as const }], blockedForPriorDebt: false }
const b = { athleteId: 'athlete-b', charges: [], blockedForPriorDebt: false }

test('KAN-627 reads a scoped page as one batch, without per-athlete requests', async () => {
  const requested: Array<{ teamId: string; athleteIds: readonly string[] }> = []
  const reader = createQuickPaymentReadService({
    listTeamAthleteSummaries: async (scope) => {
      requested.push(scope)
      return [a, b]
    },
    getTeamAthleteCharges: async () => { throw new Error('detail must not load per row') },
  })
  const rows = await reader.list({ teamId, athleteIds: ['athlete-a', 'athlete-b'] })
  assert.equal(requested.length, 1)
  assert.equal(requested[0]?.teamId, teamId)
  assert.deepEqual(requested[0]?.athleteIds, ['athlete-a', 'athlete-b'])
  assert.deepEqual(rows.map(row => row.athleteId), ['athlete-a', 'athlete-b'])
  assert.equal(rows[0]?.hasEligibleCharge, true)
  assert.equal(rows[1]?.hasEligibleCharge, false)
})

test('KAN-627 fails closed when a batch repository leaks an athlete outside the requested scope', async () => {
  const reader = createQuickPaymentReadService({
    listTeamAthleteSummaries: async () => [{ ...a, athleteId: 'another-team-athlete' }],
    getTeamAthleteCharges: async () => { throw new Error('unused') },
  })
  await assert.rejects(reader.list({ teamId, athleteIds: ['athlete-a'] }), /scope/i)
})

test('KAN-627 opens full eligible periods only on explicit athlete detail request', async () => {
  let calls = 0
  const reader = createQuickPaymentReadService({
    listTeamAthleteSummaries: async () => [],
    getTeamAthleteCharges: async (scope) => {
      calls++
      assert.deepEqual(scope, { teamId, athleteId: 'athlete-a' })
      return a
    },
  })
  const result = await reader.detail({ teamId, athleteId: 'athlete-a' })
  assert.equal(calls, 1)
  assert.deepEqual(result.charges, a.charges)
  assert.equal(result.blockedForPriorDebt, false)
})

test('KAN-627 rejects a detail result for a different athlete', async () => {
  const reader = createQuickPaymentReadService({
    listTeamAthleteSummaries: async () => [],
    getTeamAthleteCharges: async () => b,
  })
  await assert.rejects(reader.detail({ teamId, athleteId: 'athlete-a' }), /scope/i)
})
