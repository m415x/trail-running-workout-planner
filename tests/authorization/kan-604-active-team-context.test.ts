import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveActiveTeamContext } from '@/lib/authorization/active-team-context'

interface MembershipFixture {
  teamId: string
  isActive: boolean
  isDeleted: boolean
  effectiveFrom: string
  effectiveUntil: string | null
}

function membership(
  teamId: string,
  overrides: Partial<MembershipFixture> = {},
): MembershipFixture {
  return {
    teamId,
    isActive: true,
    isDeleted: false,
    effectiveFrom: '2026-01-01',
    effectiveUntil: null,
    ...overrides,
  }
}

const onDate = '2026-10-07'

describe('KAN-660 active-Team context resolution', () => {
  it('revalidates a persisted Team choice against one applicable TeamMembership', () => {
    assert.deepEqual(
      resolveActiveTeamContext({
        persistedTeamId: 'team-b',
        memberships: [
          membership('team-a'),
          membership('team-b'),
        ],
        onDate,
      }),
      {
        status: 'resolved',
        teamId: 'team-b',
        source: 'persisted',
      },
    )
  })

  it('auto-resolves exactly one applicable TeamMembership when no Team is persisted', () => {
    assert.deepEqual(
      resolveActiveTeamContext({
        persistedTeamId: null,
        memberships: [
          membership('expired', { effectiveUntil: '2026-09-30' }),
          membership('team-only'),
        ],
        onDate,
      }),
      {
        status: 'resolved',
        teamId: 'team-only',
        source: 'single_membership',
      },
    )
  })

  it('requires explicit selection when multiple TeamMemberships are applicable', () => {
    const result = resolveActiveTeamContext({
      persistedTeamId: null,
      memberships: [
        membership('team-a'),
        membership('team-b'),
      ],
      onDate,
    })

    assert.equal(result.status, 'selection_required')
  })

  it('fails closed when a persisted Team is stale or manipulated instead of silently switching Teams', () => {
    const result = resolveActiveTeamContext({
      persistedTeamId: 'team-forged',
      memberships: [
        membership('team-valid'),
      ],
      onDate,
    })

    assert.equal(result.status, 'invalid_context')
  })

  it('fails closed when the persisted Team no longer has an applicable membership', () => {
    const result = resolveActiveTeamContext({
      persistedTeamId: 'team-a',
      memberships: [
        membership('team-a', { effectiveUntil: '2026-10-01' }),
      ],
      onDate,
    })

    assert.equal(result.status, 'invalid_context')
  })

  it('fails closed when more than one applicable membership exists for the persisted Team', () => {
    const result = resolveActiveTeamContext({
      persistedTeamId: 'team-a',
      memberships: [
        membership('team-a', { effectiveFrom: '2026-01-01' }),
        membership('team-a', { effectiveFrom: '2026-09-01' }),
      ],
      onDate,
    })

    assert.equal(result.status, 'invalid_context')
  })
})
