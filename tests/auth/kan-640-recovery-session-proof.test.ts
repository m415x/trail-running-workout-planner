import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readSupabaseRecoverySessionState,
  type SupabaseRecoverySessionAuth,
} from '../../lib/auth/supabase-recovery-session-state'

function authWithClaims(amr: Array<string | { method?: string; timestamp?: number }>): SupabaseRecoverySessionAuth {
  return {
    async getClaims() {
      return {
        data: {
          claims: {
            sub: 'supabase-user-1',
            amr,
          },
        },
        error: null,
      }
    },
    async getUser() {
      return {
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      }
    },
  }
}

test('KAN-640 accepts a live Supabase session whose verified AMR contains recovery', async () => {
  assert.deepEqual(
    await readSupabaseRecoverySessionState(
      authWithClaims([{ method: 'recovery', timestamp: 1 }]),
    ),
    { status: 'verified' },
  )
})

test('KAN-640 rejects an ordinary password-authenticated session for the recovery reset surface', async () => {
  assert.deepEqual(
    await readSupabaseRecoverySessionState(
      authWithClaims([{ method: 'password', timestamp: 1 }]),
    ),
    { status: 'invalid' },
  )
})

test('KAN-640 accepts recovery when AMR also contains other methods', async () => {
  assert.deepEqual(
    await readSupabaseRecoverySessionState(
      authWithClaims([
        { method: 'password', timestamp: 1 },
        { method: 'recovery', timestamp: 2 },
      ]),
    ),
    { status: 'verified' },
  )
})



test('KAN-640 accepts the string AMR representation exposed by current Supabase types', async () => {
  assert.deepEqual(
    await readSupabaseRecoverySessionState(
      authWithClaims(['password', 'recovery']),
    ),
    { status: 'verified' },
  )
})

test('KAN-640 rejects malformed or missing AMR fail closed', async () => {
  for (const amr of [[], [{ method: '', timestamp: 1 }]]) {
    assert.deepEqual(
      await readSupabaseRecoverySessionState(authWithClaims(amr)),
      { status: 'invalid' },
    )
  }
})

test('KAN-640 rejects recovery claims when the live Supabase user does not match', async () => {
  const auth = authWithClaims([{ method: 'recovery', timestamp: 1 }])
  auth.getUser = async () => ({
    data: { user: { id: 'different-user' } },
    error: null,
  })

  assert.deepEqual(
    await readSupabaseRecoverySessionState(auth),
    { status: 'invalid' },
  )
})
