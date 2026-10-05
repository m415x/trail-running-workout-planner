import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createSupabaseProxySessionRefresher,
  type SupabaseProxyClientFactory,
} from '../../lib/auth/supabase-proxy-core'

function config() {
  return {
    url: 'https://project.supabase.co',
    publishableKey: 'sb_publishable_example',
  }
}

test('KAN-638 distinguishes an absent Supabase session from an invalid session', async () => {
  const createClient: SupabaseProxyClientFactory = () => ({
    auth: {
      async getClaims() {
        return {
          data: null,
          error: {
            name: 'AuthSessionMissingError',
            message: 'Auth session missing!',
          },
        }
      },
    },
  })

  const refresh = createSupabaseProxySessionRefresher({
    createClient,
    getConfig: config,
  })

  assert.deepEqual(
    await refresh({
      cookies: {
        getAll: () => [],
        set: () => undefined,
      },
    }),
    { status: 'anonymous', cookies: [] },
  )
})

test('KAN-638 keeps expired, revoked, or malformed sessions fail-closed as invalid', async () => {
  for (const error of [
    { name: 'AuthInvalidJwtError', message: 'JWT expired' },
    { name: 'AuthApiError', message: 'Session from session_id claim does not exist' },
    { name: 'AuthApiError', message: 'invalid claim: missing sub claim' },
  ]) {
    const refresh = createSupabaseProxySessionRefresher({
      createClient: () => ({
        auth: {
          async getClaims() {
            return { data: null, error }
          },
        },
      }),
      getConfig: config,
    })

    assert.deepEqual(
      await refresh({
        cookies: {
          getAll: () => [{ name: 'sb-auth-token', value: 'stale' }],
          set: () => undefined,
        },
      }),
      { status: 'invalid', cookies: [] },
    )
  }
})

test('KAN-638 keeps verified claims distinct from anonymous and invalid states', async () => {
  const refresh = createSupabaseProxySessionRefresher({
    createClient: () => ({
      auth: {
        async getClaims() {
          return {
            data: { claims: { sub: 'verified-subject' } },
            error: null,
          }
        },
      },
    }),
    getConfig: config,
  })

  assert.deepEqual(
    await refresh({
      cookies: {
        getAll: () => [],
        set: () => undefined,
      },
    }),
    { status: 'verified', cookies: [] },
  )
})
