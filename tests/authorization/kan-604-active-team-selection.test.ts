import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ACTIVE_TEAM_COOKIE_NAME,
  activeTeamCookie,
  clearActiveTeamCookie,
  validateActiveTeamSelection,
} from '@/lib/authorization/active-team-selection'

const at = '2026-10-07T12:00:00.000Z'

function membership(overrides: Partial<{
  userId: string
  teamId: string
  effectiveFrom: string
  effectiveUntil: string | null
  isActive: boolean
  isDeleted: boolean
}> = {}) {
  return {
    userId: 'user-1',
    teamId: 'team-a',
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    effectiveUntil: null,
    isActive: true,
    isDeleted: false,
    ...overrides,
  }
}

describe('KAN-660 validated active-Team selection', () => {
  it('accepts only one applicable membership for the authenticated actor and proposed Team', () => {
    assert.deepEqual(
      validateActiveTeamSelection({
        userId: 'user-1',
        proposedTeamId: 'team-b',
        at,
        memberships: [
          membership({ teamId: 'team-a' }),
          membership({ teamId: 'team-b' }),
        ],
      }),
      { status: 'accepted', teamId: 'team-b' },
    )
  })

  it('rejects a Team that belongs only to another user', () => {
    assert.deepEqual(
      validateActiveTeamSelection({
        userId: 'user-1',
        proposedTeamId: 'team-b',
        at,
        memberships: [
          membership({ userId: 'user-2', teamId: 'team-b' }),
        ],
      }),
      { status: 'rejected' },
    )
  })

  it('rejects expired, inactive, deleted or ambiguous memberships', () => {
    for (const memberships of [
      [membership({ teamId: 'team-b', effectiveUntil: '2026-10-01T00:00:00.000Z' })],
      [membership({ teamId: 'team-b', isActive: false })],
      [membership({ teamId: 'team-b', isDeleted: true })],
      [
        membership({ teamId: 'team-b', effectiveFrom: '2026-01-01T00:00:00.000Z' }),
        membership({ teamId: 'team-b', effectiveFrom: '2026-09-01T00:00:00.000Z' }),
      ],
    ]) {
      assert.deepEqual(
        validateActiveTeamSelection({
          userId: 'user-1',
          proposedTeamId: 'team-b',
          at,
          memberships,
        }),
        { status: 'rejected' },
      )
    }
  })
})

describe('KAN-660 active-Team cookie contract', () => {
  it('persists only the selected teamId in a server-controlled HttpOnly cookie', () => {
    assert.equal(ACTIVE_TEAM_COOKIE_NAME, 'ept_active_team')

    assert.deepEqual(
      activeTeamCookie('team-b', { secure: true }),
      {
        name: 'ept_active_team',
        value: 'team-b',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: true,
        },
      },
    )
  })

  it('clears the same cookie without carrying authorization state', () => {
    assert.deepEqual(
      clearActiveTeamCookie({ secure: false }),
      {
        name: 'ept_active_team',
        value: '',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: false,
          maxAge: 0,
        },
      },
    )
  })
})
