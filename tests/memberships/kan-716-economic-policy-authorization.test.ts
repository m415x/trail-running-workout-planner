import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6PolicyAction } from '@/lib/memberships/h6-policy-action'
import type { RequireAuthenticatedActionResult } from '@/lib/auth/require-authenticated-action'

const at = '2026-10-09T12:00:00.000Z'
const validInput = { effectiveFrom: '2026-11-01', defaultMonthlyAmountMinor: 2500000, currency: 'ARS', ordinaryDueDay: 5 }
const actor: RequireAuthenticatedActionResult = { status: 'authenticated', userId: 'coach_a' }

function fixture(granted: boolean, teamId = 'team_a') {
  let persisted = 0
  let revalidated = 0
  const observed: string[] = []
  const action = createH6PolicyAction({
    authenticate: async () => actor,
    authorize: async (access, request) => {
      assert.deepEqual(access, actor)
      assert.equal(request.capability, 'economic_policy.manage')
      assert.equal(request.resourceId, '__active_team_policy__')
      assert.equal(request.at, at)
      return granted ? { allowed: true as const, teamId } : { allowed: false as const }
    },
    configure: async (selectedTeam, input) => {
      observed.push(selectedTeam)
      assert.deepEqual(input, validInput)
      persisted += 1
      return { success: true as const }
    },
    revalidate: () => { revalidated += 1 },
    now: () => at,
  })
  return { action, persisted: () => persisted, revalidated: () => revalidated, observed }
}

test('KAN-716 policy mutation proceeds only after economic_policy.manage; server Team is the write subject', async () => {
  const h = fixture(true, 'team_b')
  assert.deepEqual(await h.action(validInput), { success: true })
  assert.deepEqual(h.observed, ['team_b'])
  assert.equal(h.persisted(), 1)
  assert.equal(h.revalidated(), 1)
})

test('KAN-716 denied policy authorization has no persistence and no revalidate', async () => {
  const h = fixture(false)
  const decision = await h.action(validInput)
  assert.equal(decision.success, false)
  assert.equal(h.persisted(), 0)
  assert.equal(h.revalidated(), 0)
})

test('KAN-716 invalid H2 actor never invokes economic policy persistence', async () => {
  let authorizationCalls = 0
  let persisted = 0
  const action = createH6PolicyAction({
    authenticate: async () => ({ status: 'forbidden' as const, reason: 'anonymous' as const }),
    authorize: async () => { authorizationCalls += 1; return { allowed: true as const, teamId: 'team_a' } },
    configure: async () => { persisted += 1; return { success: true as const } },
    revalidate: () => { throw new Error('DENY must not revalidate') },
    now: () => at,
  })
  assert.equal((await action(validInput)).success, false)
  assert.equal(authorizationCalls, 0)
  assert.equal(persisted, 0)
})
