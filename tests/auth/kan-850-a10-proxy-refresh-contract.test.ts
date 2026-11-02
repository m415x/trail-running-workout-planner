import assert from 'node:assert/strict'
import test from 'node:test'

import { createSupabaseProxySessionRefresher, type SupabaseProxyCookie } from '../../lib/auth/supabase-proxy-core'
import { carryAuthRefreshIntoResponse, type ProxyResponseLike } from '../../lib/auth/proxy-response'

function response(): ProxyResponseLike {
  const cookieJar = new Map<string, { name: string, value: string, options?: Record<string, unknown> }>()
  const headers = new Map<string, string>()
  return {
    cookies: {
      getAll: () => [...cookieJar.values()],
      set: cookie => { cookieJar.set(cookie.name, cookie) },
    },
    headers: {
      get: name => headers.get(name.toLowerCase()) ?? null,
      set: (name, value) => { headers.set(name.toLowerCase(), value) },
    },
  }
}

test('KAN-850 A10 carries proxy-issued refreshed cookies and no-store headers through localized response', async () => {
  const requestCookies = new Map<string, SupabaseProxyCookie>([['session', { name: 'session', value: 'old' }]])
  const updatedCookies: SupabaseProxyCookie[] = [{ name: 'session', value: 'new', options: { httpOnly: true, path: '/' } }]
  let claimsCalls = 0
  const refresh = createSupabaseProxySessionRefresher({
    getConfig: () => ({ url: 'https://example.supabase.co', publishableKey: 'public-test-key' }),
    createClient: ({ cookies }) => ({
      auth: {
        getClaims: async () => {
          claimsCalls++
          cookies.setAll(updatedCookies)
          return { data: { claims: { sub: 'coach-test-subject' } }, error: null }
        },
      },
    }),
  })
  const result = await refresh({
    cookies: {
      getAll: () => [...requestCookies.values()],
      set: cookie => { requestCookies.set(cookie.name, cookie) },
    },
  })
  assert.equal(result.status, 'verified')
  assert.equal(claimsCalls, 1)
  assert.deepEqual(result.cookies.map(cookie => cookie.name), ['session'])
  assert.equal(requestCookies.get('session')?.value, 'new')

  const authResponse = response()
  const localizedResponse = response()
  for (const cookie of result.cookies) authResponse.cookies.set(cookie)
  authResponse.headers.set('Cache-Control', 'private, no-store')
  authResponse.headers.set('Pragma', 'no-cache')
  authResponse.headers.set('Expires', '0')
  const carried = carryAuthRefreshIntoResponse(authResponse, localizedResponse)
  assert.equal(carried, localizedResponse)
  assert.equal(carried.cookies.getAll()[0]?.value, 'new')
  assert.equal(carried.cookies.getAll()[0]?.options?.httpOnly, true)
  assert.equal(carried.headers.get('cache-control'), 'private, no-store')
  assert.equal(carried.headers.get('pragma'), 'no-cache')
  assert.equal(carried.headers.get('expires'), '0')
})

test('KAN-850 A10 missing Supabase session returns anonymous and no rotated cookies', async () => {
  const refresh = createSupabaseProxySessionRefresher({
    getConfig: () => ({ url: 'https://example.supabase.co', publishableKey: 'public-test-key' }),
    createClient: () => ({ auth: { getClaims: async () => ({ data: null, error: { name: 'AuthSessionMissingError' } }) } }),
  })
  const result = await refresh({ cookies: { getAll: () => [], set: () => {} } })
  assert.deepEqual(result, { status: 'anonymous', cookies: [] })
})

test('KAN-850 A10 invalid claims never receive verified status or refreshed cookies', async () => {
  const refresh = createSupabaseProxySessionRefresher({
    getConfig: () => ({ url: 'https://example.supabase.co', publishableKey: 'public-test-key' }),
    createClient: ({ cookies }) => ({ auth: { getClaims: async () => {
      cookies.setAll([{ name: 'session', value: 'untrusted' }])
      return { data: null, error: new Error('invalid refresh') }
    } } }),
  })
  const result = await refresh({ cookies: { getAll: () => [], set: () => {} } })
  assert.equal(result.status, 'invalid')
  assert.deepEqual(result.cookies, [])
})
