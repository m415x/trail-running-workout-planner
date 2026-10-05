import assert from 'node:assert/strict'
import test from 'node:test'

import {
  refreshSupabaseAuthCookies,
  type AuthCookie,
  type AuthCookieRequest,
  type AuthCookieResponse,
  type SupabaseServerClientFactory,
} from '../../lib/auth/supabase-cookie-session'

function fixture() {
  const requestWrites: AuthCookie[] = []
  const responseWrites: AuthCookie[] = []
  const headers = new Map<string, string>()
  let claimsCalls = 0

  const request: AuthCookieRequest = {
    getAll() {
      return [{ name: 'sb-existing', value: 'old-token' }]
    },
    set(cookie) {
      requestWrites.push(cookie)
    },
  }

  const response: AuthCookieResponse = {
    setCookie(cookie) {
      responseWrites.push(cookie)
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value)
    },
  }

  const createClient: SupabaseServerClientFactory = ({ cookies }) => ({
    auth: {
      async getClaims() {
        claimsCalls += 1
        cookies.setAll(
          [
            {
              name: 'sb-refreshed',
              value: 'new-token',
              options: { httpOnly: true, sameSite: 'lax' },
            },
          ],
          {
            'Cache-Control': 'private, no-store',
          },
        )

        return {
          data: { claims: { sub: 'verified-subject' } },
          error: null,
        }
      },
    },
  })

  return {
    request,
    response,
    createClient,
    requestWrites,
    responseWrites,
    headers,
    getClaimsCalls: () => claimsCalls,
  }
}

test('KAN-638 refreshes auth through getClaims and mirrors rotated cookies to request and response', async () => {
  const f = fixture()

  await refreshSupabaseAuthCookies({
    request: f.request,
    response: f.response,
    createClient: f.createClient,
  })

  assert.equal(f.getClaimsCalls(), 1)
  assert.deepEqual(f.requestWrites, [
    {
      name: 'sb-refreshed',
      value: 'new-token',
      options: { httpOnly: true, sameSite: 'lax' },
    },
  ])
  assert.deepEqual(f.responseWrites, f.requestWrites)
})

test('KAN-638 forwards refresh cache headers supplied by the SSR cookie callback', async () => {
  const f = fixture()

  await refreshSupabaseAuthCookies({
    request: f.request,
    response: f.response,
    createClient: f.createClient,
  })

  assert.equal(f.headers.get('cache-control'), 'private, no-store')
})

test('KAN-638 exposes incoming request cookies to the Supabase SSR client', async () => {
  let seenCookies: AuthCookie[] = []

  const createClient: SupabaseServerClientFactory = ({ cookies }) => {
    seenCookies = cookies.getAll()

    return {
      auth: {
        async getClaims() {
          return { data: { claims: { sub: 'verified-subject' } }, error: null }
        },
      },
    }
  }

  await refreshSupabaseAuthCookies({
    request: {
      getAll: () => [{ name: 'sb-access', value: 'token' }],
      set: () => undefined,
    },
    response: {
      setCookie: () => undefined,
      setHeader: () => undefined,
    },
    createClient,
  })

  assert.deepEqual(seenCookies, [{ name: 'sb-access', value: 'token' }])
})

test('KAN-638 still fails closed at the auth layer when getClaims cannot verify the token', async () => {
  let calls = 0

  const result = await refreshSupabaseAuthCookies({
    request: {
      getAll: () => [],
      set: () => undefined,
    },
    response: {
      setCookie: () => undefined,
      setHeader: () => undefined,
    },
    createClient: () => ({
      auth: {
        async getClaims() {
          calls += 1
          return { data: null, error: new Error('expired or revoked') }
        },
      },
    }),
  })

  assert.equal(calls, 1)
  assert.deepEqual(result, { status: 'invalid' })
})
