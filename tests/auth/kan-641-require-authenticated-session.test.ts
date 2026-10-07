import assert from 'node:assert/strict'
import test from 'node:test'

import {
  requireAuthenticatedEptSession,
  type RequireAuthenticatedSessionDeps,
} from '../../lib/auth/require-authenticated-session'

function depsFor(status: 'anonymous' | 'unlinked' | 'authenticated' | 'invalid'): RequireAuthenticatedSessionDeps {
  return {
    async readAccess() {
      if (status === 'authenticated') {
        return {
          status: 'authenticated',
          provider: 'supabase',
          subject: 'subject-1',
          userId: 'user-1',
        }
      }

      if (status === 'unlinked') {
        return {
          status: 'unlinked',
          provider: 'supabase',
          subject: 'subject-1',
        }
      }

      return { status }
    },
  }
}

test('KAN-641 allows only authenticated EPT identity through protected server surfaces', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptSession(depsFor('authenticated')),
    { status: 'authenticated', userId: 'user-1' },
  )
})

test('KAN-641 redirects anonymous users to localized login with safe return path', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptSession(depsFor('anonymous'), {
      locale: 'es',
      returnTo: '/es/dashboard',
    }),
    {
      status: 'redirect',
      location: '/es/login?returnTo=%2Fes%2Fdashboard',
    },
  )
})

test('KAN-641 returns an explicit unlinked outcome without granting access', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptSession(depsFor('unlinked'), {
      locale: 'en',
      returnTo: '/en',
    }),
    {
      status: 'unlinked',
    },
  )
})

test('KAN-641 fails closed for invalid session state', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptSession(depsFor('invalid'), {
      locale: 'es',
      returnTo: '/es/dashboard',
    }),
    {
      status: 'redirect',
      location: '/es/login?returnTo=%2Fes%2Fdashboard',
    },
  )
})

test('KAN-641 sanitizes return paths before placing them in login redirects', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptSession(depsFor('anonymous'), {
      locale: 'es',
      returnTo: 'https://evil.example/steal',
    }),
    {
      status: 'redirect',
      location: '/es/login?returnTo=%2Fes',
    },
  )
})
