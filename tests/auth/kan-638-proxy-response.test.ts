import assert from 'node:assert/strict'
import test from 'node:test'

import {
  carryAuthRefreshIntoResponse,
  type ProxyResponseLike,
} from '../../lib/auth/proxy-response'

function responseFixture(input?: {
  cookies?: Array<{ name: string; value: string; options?: Record<string, unknown> }>
  headers?: Record<string, string>
}) {
  const cookies = [...(input?.cookies ?? [])]
  const headers = new Map(
    Object.entries(input?.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  )

  const response: ProxyResponseLike = {
    cookies: {
      getAll: () => [...cookies],
      set(cookie) {
        const index = cookies.findIndex((current) => current.name === cookie.name)

        if (index >= 0) {
          cookies[index] = cookie
        } else {
          cookies.push(cookie)
        }
      },
    },
    headers: {
      get(name) {
        return headers.get(name.toLowerCase()) ?? null
      },
      set(name, value) {
        headers.set(name.toLowerCase(), value)
      },
    },
  }

  return { response, cookies, headers }
}

test('KAN-638 copies refreshed Supabase cookies when next-intl returns a different response', () => {
  const auth = responseFixture({
    cookies: [
      {
        name: 'sb-access-token',
        value: 'rotated',
        options: { httpOnly: true, sameSite: 'lax' },
      },
    ],
  })
  const localized = responseFixture({
    cookies: [{ name: 'NEXT_LOCALE', value: 'es' }],
  })

  const result = carryAuthRefreshIntoResponse(auth.response, localized.response)

  assert.equal(result, localized.response)
  assert.deepEqual(localized.cookies, [
    { name: 'NEXT_LOCALE', value: 'es' },
    {
      name: 'sb-access-token',
      value: 'rotated',
      options: { httpOnly: true, sameSite: 'lax' },
    },
  ])
})

test('KAN-638 carries only auth cache-safety headers onto the localized response', () => {
  const auth = responseFixture({
    headers: {
      'cache-control': 'private, no-store',
      expires: '0',
      pragma: 'no-cache',
      'x-auth-internal': 'must-not-leak',
    },
  })
  const localized = responseFixture({
    headers: {
      'x-next-intl': 'preserved',
    },
  })

  carryAuthRefreshIntoResponse(auth.response, localized.response)

  assert.equal(localized.headers.get('cache-control'), 'private, no-store')
  assert.equal(localized.headers.get('expires'), '0')
  assert.equal(localized.headers.get('pragma'), 'no-cache')
  assert.equal(localized.headers.get('x-next-intl'), 'preserved')
  assert.equal(localized.headers.get('x-auth-internal'), undefined)
})

test('KAN-638 preserves localized cookies and headers while overlaying refreshed auth state', () => {
  const auth = responseFixture({
    cookies: [{ name: 'sb-refresh-token', value: 'fresh' }],
    headers: { 'cache-control': 'private, no-store' },
  })
  const localized = responseFixture({
    cookies: [
      { name: 'NEXT_LOCALE', value: 'en' },
      { name: 'app-pref', value: 'compact' },
    ],
    headers: { vary: 'accept-language' },
  })

  carryAuthRefreshIntoResponse(auth.response, localized.response)

  assert.deepEqual(localized.cookies, [
    { name: 'NEXT_LOCALE', value: 'en' },
    { name: 'app-pref', value: 'compact' },
    { name: 'sb-refresh-token', value: 'fresh' },
  ])
  assert.equal(localized.headers.get('vary'), 'accept-language')
  assert.equal(localized.headers.get('cache-control'), 'private, no-store')
})

test('KAN-638 lets refreshed auth cookies replace stale cookies with the same name', () => {
  const auth = responseFixture({
    cookies: [{ name: 'sb-access-token', value: 'new-token' }],
  })
  const localized = responseFixture({
    cookies: [{ name: 'sb-access-token', value: 'stale-token' }],
  })

  carryAuthRefreshIntoResponse(auth.response, localized.response)

  assert.deepEqual(localized.cookies, [
    { name: 'sb-access-token', value: 'new-token' },
  ])
})
