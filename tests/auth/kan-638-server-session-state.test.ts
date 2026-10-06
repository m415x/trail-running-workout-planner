import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readSupabaseServerSessionState,
  type SupabaseServerSessionAuth,
} from '../../lib/auth/supabase-server-session-state'

function claimsResult(
  subject: string | null,
  error: unknown = null,
): ReturnType<SupabaseServerSessionAuth['getClaims']> {
  return Promise.resolve({
    data: subject === null ? null : { claims: { sub: subject } },
    error,
  })
}

test('KAN-638 classifies a missing server-side session as anonymous', async () => {
  let getUserCalls = 0
  const auth: SupabaseServerSessionAuth = {
    getClaims: () =>
      claimsResult(null, { name: 'AuthSessionMissingError' }),
    async getUser() {
      getUserCalls += 1
      throw new Error('getUser must not run without a session')
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'anonymous',
  })
  assert.equal(getUserCalls, 0)
})

test('KAN-638 classifies an expired session separately from other invalid auth state', async () => {
  const auth: SupabaseServerSessionAuth = {
    getClaims: () =>
      claimsResult(null, {
        name: 'AuthApiError',
        code: 'session_expired',
        status: 401,
      }),
    async getUser() {
      throw new Error('getUser must not run after expired claims')
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'expired',
  })
})

test('KAN-638 confirms a verified JWT against the Auth server so revoked sessions are detected', async () => {
  let getUserCalls = 0
  const auth: SupabaseServerSessionAuth = {
    getClaims: () => claimsResult('supabase-user-123'),
    async getUser() {
      getUserCalls += 1
      return {
        data: { user: null },
        error: {
          name: 'AuthApiError',
          code: 'session_not_found',
          status: 403,
        },
      }
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'revoked',
  })
  assert.equal(getUserCalls, 1)
})

test('KAN-638 returns verified only when claims and the live Auth session agree on the subject', async () => {
  const auth: SupabaseServerSessionAuth = {
    getClaims: () => claimsResult('supabase-user-123'),
    async getUser() {
      return {
        data: {
          user: {
            id: 'supabase-user-123',
          },
        },
        error: null,
      }
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'verified',
    externalSubject: {
      provider: 'supabase',
      subject: 'supabase-user-123',
    },
  })
})

test('KAN-638 fails closed when claims and live user subjects disagree', async () => {
  const auth: SupabaseServerSessionAuth = {
    getClaims: () => claimsResult('claims-subject'),
    async getUser() {
      return {
        data: {
          user: {
            id: 'different-user',
          },
        },
        error: null,
      }
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'invalid',
  })
})

test('KAN-638 keeps Auth server failures distinct from revocation', async () => {
  const auth: SupabaseServerSessionAuth = {
    getClaims: () => claimsResult('supabase-user-123'),
    async getUser() {
      return {
        data: { user: null },
        error: {
          name: 'AuthRetryableFetchError',
          status: 503,
        },
      }
    },
  }

  assert.deepEqual(await readSupabaseServerSessionState(auth), {
    status: 'invalid',
  })
})
