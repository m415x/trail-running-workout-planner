import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createH4aAuthorizationAdapter,
  type H4aAuthorizationEvidenceSource,
} from '@/lib/authorization/h4a-authorization-adapter'

function source(overrides: Partial<H4aAuthorizationEvidenceSource> = {}): H4aAuthorizationEvidenceSource {
  return {
    async loadMemberships() {
      return [{
        userId: 'user-1',
        teamId: 'team-a',
        preset: 'coach',
        effectiveFrom: '2026-01-01T00:00:00.000Z',
        effectiveUntil: null,
        isActive: true,
      }]
    },
    async loadAthleteProfiles() {
      return []
    },
    async loadGrants() {
      return []
    },
    ...overrides,
  }
}

describe('KAN-660 H4A authorization adapter', () => {
  it('derives actor only from authenticated H2 access and delegates the final decision to H3', async () => {
    const adapter = createH4aAuthorizationAdapter(source())

    assert.deepEqual(
      await adapter.authorize(
        { status: 'authenticated', userId: 'user-1' },
        {
          teamId: 'team-a',
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-a' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      { allowed: true },
    )
  })

  it('fails closed before loading H3 evidence for forbidden H2 access', async () => {
    let loads = 0
    const adapter = createH4aAuthorizationAdapter(source({
      async loadMemberships() {
        loads += 1
        return []
      },
      async loadAthleteProfiles() {
        loads += 1
        return []
      },
      async loadGrants() {
        loads += 1
        return []
      },
    }))

    assert.deepEqual(
      await adapter.authorize(
        { status: 'forbidden', reason: 'anonymous' },
        {
          teamId: 'team-a',
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-a' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      { allowed: false },
    )
    assert.equal(loads, 0)
  })

  it('loads evidence for the authenticated user and resolved Team only', async () => {
    const calls: string[] = []
    const adapter = createH4aAuthorizationAdapter(source({
      async loadMemberships(userId, teamId) {
        calls.push(`memberships:${userId}:${teamId}`)
        return [{
          userId,
          teamId,
          preset: 'assistant',
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveUntil: null,
          isActive: true,
        }]
      },
      async loadAthleteProfiles(userId, teamId) {
        calls.push(`profiles:${userId}:${teamId}`)
        return []
      },
      async loadGrants(userId, teamId) {
        calls.push(`grants:${userId}:${teamId}`)
        return []
      },
    }))

    await adapter.authorize(
      { status: 'authenticated', userId: 'user-1' },
      {
        teamId: 'team-a',
        capability: 'sporting_group.admin.manage',
        resource: { teamId: 'team-a' },
        at: '2026-10-07T12:00:00.000Z',
        requiredScope: 'team',
      },
    )

    assert.deepEqual(calls.sort(), [
      'grants:user-1:team-a',
      'memberships:user-1:team-a',
      'profiles:user-1:team-a',
    ])
  })

  it('cannot authorize a cross-Team resource even when base capability exists', async () => {
    const adapter = createH4aAuthorizationAdapter(source())

    assert.deepEqual(
      await adapter.authorize(
        { status: 'authenticated', userId: 'user-1' },
        {
          teamId: 'team-a',
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-b' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      { allowed: false },
    )
  })
})
