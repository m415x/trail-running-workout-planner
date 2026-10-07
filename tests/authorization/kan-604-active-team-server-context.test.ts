import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createActiveTeamServerContext,
  type ActiveTeamCookieStore,
} from '@/lib/authorization/active-team-server-context'

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

function cookieStore(initial: string | null = null) {
  const writes: Array<{ name: string; value: string; options: Record<string, unknown> }> = []
  const store: ActiveTeamCookieStore = {
    get(name) {
      return name === 'ept_active_team' && initial !== null
        ? { value: initial }
        : undefined
    },
    set(name, value, options) {
      writes.push({ name, value, options })
    },
  }

  return { store, writes }
}

describe('KAN-660 active-Team server context', () => {
  it('reads the persisted Team and revalidates it for the authenticated user', async () => {
    const cookies = cookieStore('team-b')
    const context = createActiveTeamServerContext({
      cookies: () => Promise.resolve(cookies.store),
      loadMemberships: async (userId) => [
        membership({ userId, teamId: 'team-a' }),
        membership({ userId, teamId: 'team-b' }),
      ],
      now: () => '2026-10-07T12:00:00.000Z',
      secureCookies: false,
    })

    assert.deepEqual(
      await context.resolve('user-1'),
      {
        status: 'resolved',
        teamId: 'team-b',
        source: 'persisted',
      },
    )
    assert.deepEqual(cookies.writes, [])
  })

  it('auto-resolves a single membership without silently persisting from a read boundary', async () => {
    const cookies = cookieStore()
    const context = createActiveTeamServerContext({
      cookies: () => Promise.resolve(cookies.store),
      loadMemberships: async (userId) => [
        membership({ userId, teamId: 'team-only' }),
      ],
      now: () => '2026-10-07T12:00:00.000Z',
      secureCookies: false,
    })

    assert.deepEqual(
      await context.resolve('user-1'),
      {
        status: 'resolved',
        teamId: 'team-only',
        source: 'single_membership',
      },
    )
    assert.deepEqual(cookies.writes, [])
  })

  it('persists an explicitly proposed Team only after server-side membership validation', async () => {
    const cookies = cookieStore()
    const context = createActiveTeamServerContext({
      cookies: () => Promise.resolve(cookies.store),
      loadMemberships: async (userId) => [
        membership({ userId, teamId: 'team-a' }),
        membership({ userId, teamId: 'team-b' }),
      ],
      now: () => '2026-10-07T12:00:00.000Z',
      secureCookies: true,
    })

    assert.deepEqual(
      await context.select('user-1', 'team-b'),
      { status: 'accepted', teamId: 'team-b' },
    )

    assert.deepEqual(cookies.writes, [{
      name: 'ept_active_team',
      value: 'team-b',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    }])
  })

  it('does not persist a rejected Team proposal', async () => {
    const cookies = cookieStore()
    const context = createActiveTeamServerContext({
      cookies: () => Promise.resolve(cookies.store),
      loadMemberships: async (userId) => [
        membership({ userId, teamId: 'team-a' }),
      ],
      now: () => '2026-10-07T12:00:00.000Z',
      secureCookies: false,
    })

    assert.deepEqual(
      await context.select('user-1', 'team-forged'),
      { status: 'rejected' },
    )
    assert.deepEqual(cookies.writes, [])
  })

  it('clears the active-Team cookie through the same server-controlled store', async () => {
    const cookies = cookieStore('team-a')
    const context = createActiveTeamServerContext({
      cookies: () => Promise.resolve(cookies.store),
      loadMemberships: async () => [],
      now: () => '2026-10-07T12:00:00.000Z',
      secureCookies: false,
    })

    await context.clear()

    assert.deepEqual(cookies.writes, [{
      name: 'ept_active_team',
      value: '',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
        maxAge: 0,
      },
    }])
  })
})
