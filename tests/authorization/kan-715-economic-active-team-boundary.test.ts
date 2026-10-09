import assert from 'node:assert/strict'
import test from 'node:test'

import { createH6EconomicAuthorizationBoundary } from '@/lib/authorization/h6-economic-authorization'
import type { EffectiveTeamMembership } from '@/lib/authorization/effective-authorization'

const at = '2026-10-09T12:00:00.000Z'
const access = { status: 'authenticated' as const, userId: 'user_1' }
const membership: EffectiveTeamMembership = {
  userId: 'user_1', teamId: 'team_a', preset: 'coach',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  effectiveUntil: null, isActive: true,
}

function harness(options: {
  preset?: EffectiveTeamMembership['preset']
  members?: EffectiveTeamMembership[]
  activeTeam?: { status: string; teamId?: string }
  ownerTeamId?: string | null
  failOwnership?: boolean
} = {}) {
  let writes = 0
  const boundary = createH6EconomicAuthorizationBoundary({
    resolveActiveTeam: async () => options.activeTeam ?? { status: 'resolved', teamId: 'team_a' },
    loadMemberships: async () => options.members ?? [{ ...membership, preset: options.preset ?? 'coach' }],
    resolveResourceTeam: async () => {
      if (options.failOwnership) throw new Error('persistence unavailable')
      return options.ownerTeamId === undefined ? 'team_a' : options.ownerTeamId
    },
  })
  return {
    boundary,
    writes: () => writes,
    persist: () => { writes += 1 },
  }
}

test('KAN-715 policy and operations are distinct effective Team capabilities', async () => {
  for (const preset of ['athlete', 'assistant', 'coach', 'admin'] as const) {
    const h = harness({ preset })
    const economic = await h.boundary.authorize(access, { at, capability: 'economy.manage', resourceId: 'charge_1' })
    const policy = await h.boundary.authorize(access, { at, capability: 'economic_policy.manage', resourceId: 'policy_1' })
    assert.equal(economic.allowed, preset !== 'athlete', `economic: ${preset}`)
    assert.equal(policy.allowed, preset === 'coach' || preset === 'admin', `policy: ${preset}`)
  }
})

test('KAN-715 fails closed on invalid H2, Team, revocation, duplicate membership and mismatched ownership', async () => {
  const cases = [
    { h: harness(), actor: { status: 'forbidden' as const, reason: 'anonymous' as const } },
    { h: harness({ activeTeam: { status: 'denied' } }), actor: access },
    { h: harness({ activeTeam: { status: 'resolved', teamId: 'team_b' } }), actor: access },
    { h: harness({ members: [{ ...membership, isActive: false }] }), actor: access },
    { h: harness({ members: [membership, membership] }), actor: access },
    { h: harness({ ownerTeamId: 'team_b' }), actor: access },
    { h: harness({ ownerTeamId: null }), actor: access },
    { h: harness({ failOwnership: true }), actor: access },
  ]
  for (const { h, actor } of cases) {
    const decision = await h.boundary.authorize(actor, { at, capability: 'economy.manage', resourceId: 'charge_1' })
    assert.equal(decision.allowed, false)
    assert.equal(h.writes(), 0)
  }
})
