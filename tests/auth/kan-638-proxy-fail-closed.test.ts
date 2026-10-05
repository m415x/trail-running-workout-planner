import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSupabaseProxySessionRefresher,
  type SupabaseProxyClientFactory,
} from '../../lib/auth/supabase-proxy-core'

test('KAN-638 fails closed when Supabase Auth public configuration is missing', async () => {
  let factoryCalls = 0

  const createClient: SupabaseProxyClientFactory = () => {
    factoryCalls += 1
    throw new Error('factory must not be called without complete config')
  }

  const refresh = createSupabaseProxySessionRefresher({
    createClient,
    getConfig: () => ({
      url: undefined,
      publishableKey: undefined,
    }),
  })

  const result = await refresh({
    cookies: {
      getAll: () => [],
      set: () => undefined,
    },
  })

  assert.deepEqual(result, { status: 'invalid', cookies: [] })
  assert.equal(factoryCalls, 0)
})

test('KAN-638 fails closed when only one Supabase Auth config value is present', async () => {
  for (const config of [
    { url: 'https://project.supabase.co', publishableKey: undefined },
    { url: undefined, publishableKey: 'sb_publishable_example' },
  ]) {
    let factoryCalls = 0

    const refresh = createSupabaseProxySessionRefresher({
      createClient: () => {
        factoryCalls += 1
        throw new Error('factory must not be called with partial config')
      },
      getConfig: () => config,
    })

    assert.deepEqual(
      await refresh({
        cookies: {
          getAll: () => [],
          set: () => undefined,
        },
      }),
      { status: 'invalid', cookies: [] },
    )
    assert.equal(factoryCalls, 0)
  }
})

test('KAN-638 catches client construction failures and returns invalid instead of throwing through proxy', async () => {
  const refresh = createSupabaseProxySessionRefresher({
    createClient: () => {
      throw new Error('Supabase client construction failed')
    },
    getConfig: () => ({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example',
    }),
  })

  const result = await refresh({
    cookies: {
      getAll: () => [{ name: 'sb-access', value: 'stale' }],
      set: () => undefined,
    },
  })

  assert.deepEqual(result, { status: 'invalid', cookies: [] })
})

test('KAN-638 returns rotated cookies only after claims verification succeeds', async () => {
  const refresh = createSupabaseProxySessionRefresher({
    createClient: ({ cookies }) => ({
      auth: {
        async getClaims() {
          cookies.setAll([
            {
              name: 'sb-access',
              value: 'fresh',
              options: { httpOnly: true },
            },
          ])

          return {
            data: { claims: { sub: 'verified-subject' } },
            error: null,
          }
        },
      },
    }),
    getConfig: () => ({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_example',
    }),
  })

  const result = await refresh({
    cookies: {
      getAll: () => [{ name: 'sb-access', value: 'stale' }],
      set: () => undefined,
    },
  })

  assert.deepEqual(result, {
    status: 'verified',
    cookies: [
      {
        name: 'sb-access',
        value: 'fresh',
        options: { httpOnly: true },
      },
    ],
  })
})
