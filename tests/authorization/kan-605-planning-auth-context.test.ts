import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createH4bPlanningAuthorizationBoundary,
  type H4bPlanningAuthorizationDeps,
} from '@/lib/authorization/h4b-planning-authorization'

const at = '2026-10-07T12:00:00.000Z'

function deps(overrides: Partial<H4bPlanningAuthorizationDeps> = {}): H4bPlanningAuthorizationDeps {
  return {
    async resolveActiveTeam() {
      return { status: 'resolved', teamId: 'team-a', source: 'persisted' }
    },
    async loadOwnership(resourceId) {
      return resourceId === 'plan-a'
        ? { teamId: 'team-a', sportingGroupIds: ['group-a'] }
        : null
    },
    async authorize(_access, request) {
      return {
        allowed:
          request.capability === 'planning.manage'
          && request.teamId === 'team-a'
          && request.resource.teamId === 'team-a'
          && request.resource.sportingGroupId === 'group-a',
      }
    },
    ...overrides,
  }
}

describe('KAN-667 H4B reusable planning authorization boundary', () => {
  it('resolves H2 actor and H4A active Team, loads persisted ownership, and uses only planning.manage', async () => {
    const calls: string[] = []
    const boundary = createH4bPlanningAuthorizationBoundary(deps({
      async resolveActiveTeam(userId) {
        calls.push(`team:${userId}`)
        return { status: 'resolved', teamId: 'team-a', source: 'persisted' }
      },
      async loadOwnership(resourceId) {
        calls.push(`ownership:${resourceId}`)
        return { teamId: 'team-a', sportingGroupIds: ['group-a'] }
      },
      async authorize(access, request) {
        calls.push(`auth:${access.status === 'authenticated' ? access.userId : 'forbidden'}:${request.capability}:${request.resource.sportingGroupId}`)
        return { allowed: true }
      },
    }))

    assert.deepEqual(
      await boundary.authorize(
        { status: 'authenticated', userId: 'user-a' },
        { resourceId: 'plan-a', at },
      ),
      { allowed: true, teamId: 'team-a' },
    )
    assert.deepEqual(calls, [
      'team:user-a',
      'ownership:plan-a',
      'auth:user-a:planning.manage:group-a',
    ])
  })

  it('denies unauthenticated access without reading Team, ownership or authorization evidence', async () => {
    let calls = 0
    const boundary = createH4bPlanningAuthorizationBoundary(deps({
      async resolveActiveTeam() { calls++; return { status: 'resolved', teamId: 'team-a', source: 'persisted' } },
      async loadOwnership() { calls++; return { teamId: 'team-a', sportingGroupIds: ['group-a'] } },
      async authorize() { calls++; return { allowed: true } },
    }))
    assert.deepEqual(
      await boundary.authorize({ status: 'forbidden', reason: 'anonymous' }, { resourceId: 'plan-a', at }),
      { allowed: false },
    )
    assert.equal(calls, 0)
  })

  it('denies missing/ambiguous active Team and missing or cross-Team persisted ownership', async () => {
    for (const status of ['selection_required', 'invalid_context'] as const) {
      let ownershipLoads = 0
      const boundary = createH4bPlanningAuthorizationBoundary(deps({
        async resolveActiveTeam() { return { status } },
        async loadOwnership() { ownershipLoads++; return { teamId: 'team-a', sportingGroupIds: ['group-a'] } },
      }))
      assert.deepEqual(
        await boundary.authorize({ status: 'authenticated', userId: 'user-a' }, { resourceId: 'plan-a', at }),
        { allowed: false },
      )
      assert.equal(ownershipLoads, 0)
    }
    for (const ownership of [null, { teamId: 'team-b', sportingGroupIds: ['group-a'] }]) {
      let grants = 0
      const boundary = createH4bPlanningAuthorizationBoundary(deps({
        async loadOwnership() { return ownership },
        async authorize() { grants++; return { allowed: true } },
      }))
      assert.deepEqual(
        await boundary.authorize({ status: 'authenticated', userId: 'user-a' }, { resourceId: 'plan-a', at }),
        { allowed: false, teamId: 'team-a' },
      )
      assert.equal(grants, 0)
    }
  })

  it('requires H3 coverage of every persisted Sporting Group without widening partial scope', async () => {
    const groups: string[] = []
    const boundary = createH4bPlanningAuthorizationBoundary(deps({
      async loadOwnership() {
        return { teamId: 'team-a', sportingGroupIds: ['group-a', 'group-b'] }
      },
      async authorize(_access, request) {
        groups.push(request.resource.sportingGroupId ?? '')
        return { allowed: request.resource.sportingGroupId === 'group-a' }
      },
    }))
    assert.deepEqual(
      await boundary.authorize({ status: 'authenticated', userId: 'user-a' }, { resourceId: 'plan-a', at }),
      { allowed: false, teamId: 'team-a' },
    )
    assert.deepEqual(groups, ['group-a', 'group-b'])
  })

  it('denies empty or duplicate ownership groups, never converting unknown scope into TEAM', async () => {
    for (const sportingGroupIds of [[], ['group-a', 'group-a']]) {
      let authorizationCalls = 0
      const boundary = createH4bPlanningAuthorizationBoundary(deps({
        async loadOwnership() { return { teamId: 'team-a', sportingGroupIds } },
        async authorize() { authorizationCalls++; return { allowed: true } },
      }))
      assert.deepEqual(
        await boundary.authorize({ status: 'authenticated', userId: 'user-a' }, { resourceId: 'plan-a', at }),
        { allowed: false, teamId: 'team-a' },
      )
      assert.equal(authorizationCalls, 0)
    }
  })
})
