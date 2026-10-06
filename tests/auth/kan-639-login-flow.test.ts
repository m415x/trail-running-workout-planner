import assert from 'node:assert/strict'
import test from 'node:test'

import {
  authenticateEptLogin,
  type SupabasePasswordLoginAuth,
} from '../../lib/auth/login-flow'
import type { ExternalIdentityLookup } from '../../lib/auth/server-session-identity'

function linkedLookup(userId = 'ept-user-1'): ExternalIdentityLookup {
  return {
    async findByProviderSubject(provider, subject) {
      assert.equal(provider, 'supabase')
      assert.equal(subject, 'supabase-user-1')

      return [{
        linkId: 'link-1',
        userId,
        linkIsDeleted: false,
        userIsDeleted: false,
      }]
    },
  }
}

function verifiedAuth(): SupabasePasswordLoginAuth {
  return {
    async signInWithPassword(credentials) {
      assert.deepEqual(credentials, {
        email: 'coach@example.com',
        password: 'secret-password',
      })

      return {
        data: { session: { access_token: 'present' } },
        error: null,
      }
    },
    async getClaims() {
      return {
        data: { claims: { sub: 'supabase-user-1' } },
        error: null,
      }
    },
    async getUser() {
      return {
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      }
    },
    async signOut() {
      return { error: null }
    },
  }
}

test('KAN-639 authenticates Supabase and resolves the linked EPT User server-side', async () => {
  const result = await authenticateEptLogin({
    auth: verifiedAuth(),
    lookup: linkedLookup(),
    email: ' coach@example.com ',
    password: 'secret-password',
    locale: 'es',
    returnTo: '/es/dashboard/sessions?view=week',
  })

  assert.deepEqual(result, {
    status: 'authenticated',
    userId: 'ept-user-1',
    returnTo: '/es/dashboard/sessions?view=week',
  })
})

test('KAN-639 does not grant EPT access to a valid Supabase user without ExternalIdentityLink', async () => {
  let signOutCalls = 0
  const auth = verifiedAuth()
  auth.signOut = async () => {
    signOutCalls += 1
    return { error: null }
  }

  const result = await authenticateEptLogin({
    auth,
    lookup: {
      async findByProviderSubject() {
        return []
      },
    },
    email: 'coach@example.com',
    password: 'secret-password',
    locale: 'en',
    returnTo: '/en/dashboard',
  })

  assert.deepEqual(result, { status: 'unlinked' })
  assert.equal(signOutCalls, 1)
})

test('KAN-639 fails closed when Supabase rejects the credentials', async () => {
  let claimsCalls = 0
  const auth: SupabasePasswordLoginAuth = {
    async signInWithPassword() {
      return {
        data: { session: null },
        error: { code: 'invalid_credentials' },
      }
    },
    async getClaims() {
      claimsCalls += 1
      throw new Error('claims must not run after failed login')
    },
    async getUser() {
      throw new Error('user must not run after failed login')
    },
    async signOut() {
      return { error: null }
    },
  }

  assert.deepEqual(
    await authenticateEptLogin({
      auth,
      lookup: linkedLookup(),
      email: 'coach@example.com',
      password: 'wrong',
      locale: 'es',
      returnTo: '/es/dashboard',
    }),
    { status: 'invalid_credentials' },
  )
  assert.equal(claimsCalls, 0)
})

test('KAN-639 fails closed and signs out when the verified Supabase identity is invalid', async () => {
  let signOutCalls = 0
  const auth = verifiedAuth()
  auth.getUser = async () => ({
    data: { user: { id: 'different-subject' } },
    error: null,
  })
  auth.signOut = async () => {
    signOutCalls += 1
    return { error: null }
  }

  assert.deepEqual(
    await authenticateEptLogin({
      auth,
      lookup: linkedLookup(),
      email: 'coach@example.com',
      password: 'secret-password',
      locale: 'es',
      returnTo: '/es/dashboard',
    }),
    { status: 'invalid' },
  )
  assert.equal(signOutCalls, 1)
})

test('KAN-639 applies the safe localized return boundary after successful identity resolution', async () => {
  const result = await authenticateEptLogin({
    auth: verifiedAuth(),
    lookup: linkedLookup(),
    email: 'coach@example.com',
    password: 'secret-password',
    locale: 'es',
    returnTo: 'https://evil.example/steal',
  })

  assert.deepEqual(result, {
    status: 'authenticated',
    userId: 'ept-user-1',
    returnTo: '/es',
  })
})
