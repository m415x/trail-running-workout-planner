import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import {
  createH4aActiveTeamAuthorizationBoundary,
  type H4aActiveTeamAuthorizationDeps,
} from '@/lib/authorization/h4a-active-team-authorization'

function deps(
  overrides: Partial<H4aActiveTeamAuthorizationDeps> = {},
): H4aActiveTeamAuthorizationDeps {
  return {
    async resolveActiveTeam() {
      return {
        status: 'resolved',
        teamId: 'team-a',
        source: 'persisted',
      }
    },
    async authorize(_access, request) {
      return {
        allowed:
          request.teamId === 'team-a'
          && request.resource.teamId === 'team-a'
          && request.capability === 'athlete.admin.manage',
      }
    },
    ...overrides,
  }
}

describe('KAN-660 active-Team to H3 authorization boundary', () => {
  it('resolves active Team for the H2 actor before delegating to H3', async () => {
    const calls: string[] = []
    const boundary = createH4aActiveTeamAuthorizationBoundary(deps({
      async resolveActiveTeam(userId) {
        calls.push(`team:${userId}`)
        return {
          status: 'resolved',
          teamId: 'team-a',
          source: 'single_membership',
        }
      },
      async authorize(access, request) {
        calls.push(`auth:${access.status}:${request.teamId}`)
        return { allowed: true }
      },
    }))

    assert.deepEqual(
      await boundary.authorize(
        { status: 'authenticated', userId: 'user-1' },
        {
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-a' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      {
        allowed: true,
        teamId: 'team-a',
      },
    )

    assert.deepEqual(calls, [
      'team:user-1',
      'auth:authenticated:team-a',
    ])
  })

  it('fails closed without resolving Team for forbidden H2 access', async () => {
    let resolutions = 0
    const boundary = createH4aActiveTeamAuthorizationBoundary(deps({
      async resolveActiveTeam() {
        resolutions += 1
        return {
          status: 'resolved',
          teamId: 'team-a',
          source: 'persisted',
        }
      },
    }))

    assert.deepEqual(
      await boundary.authorize(
        { status: 'forbidden', reason: 'unlinked' },
        {
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-a' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      { allowed: false },
    )
    assert.equal(resolutions, 0)
  })

  it('fails closed when active Team is missing, ambiguous or invalid', async () => {
    for (const result of [
      { status: 'selection_required' as const },
      { status: 'invalid_context' as const },
    ]) {
      let authorizations = 0
      const boundary = createH4aActiveTeamAuthorizationBoundary(deps({
        async resolveActiveTeam() {
          return result
        },
        async authorize() {
          authorizations += 1
          return { allowed: true }
        },
      }))

      assert.deepEqual(
        await boundary.authorize(
          { status: 'authenticated', userId: 'user-1' },
          {
            capability: 'athlete.admin.manage',
            resource: { teamId: 'team-a' },
            at: '2026-10-07T12:00:00.000Z',
            requiredScope: 'team',
          },
        ),
        { allowed: false },
      )
      assert.equal(authorizations, 0)
    }
  })

  it('does not let active Team override real cross-Team resource ownership', async () => {
    const boundary = createH4aActiveTeamAuthorizationBoundary(deps())

    assert.deepEqual(
      await boundary.authorize(
        { status: 'authenticated', userId: 'user-1' },
        {
          capability: 'athlete.admin.manage',
          resource: { teamId: 'team-b' },
          at: '2026-10-07T12:00:00.000Z',
          requiredScope: 'team',
        },
      ),
      {
        allowed: false,
        teamId: 'team-a',
      },
    )
  })
})

describe('KAN-660 production H3 evidence source', () => {
  it('loads memberships, self-profile links and grants from canonical persistence scoped to actor and Team', () => {
    const source = readFileSync(
      'lib/authorization/h4a-next-server-authorization.ts',
      'utf8',
    )

    assert.match(source, /teamMemberships/)
    assert.match(source, /athleteProfiles/)
    assert.match(source, /authorizationGrants/)
    assert.match(source, /createH4aAuthorizationAdapter/)
    assert.match(source, /createActiveTeamNextServerContext/)
    assert.match(source, /eq\(teamMemberships\.userId,\s*userId\)/)
    assert.match(source, /eq\(teamMemberships\.teamId,\s*teamId\)/)
    assert.match(source, /eq\(athleteProfiles\.userId,\s*userId\)/)
    assert.match(source, /eq\(athleteProfiles\.teamId,\s*teamId\)/)
    assert.match(source, /eq\(authorizationGrants\.beneficiaryUserId,\s*userId\)/)
    assert.match(source, /eq\(authorizationGrants\.teamId,\s*teamId\)/)
    assert.doesNotMatch(source, /CURRENT_TEAM_ID/)
  })
})
