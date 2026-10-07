import assert from 'node:assert/strict'
import test from 'node:test'

import {
  exchangePasswordRecoveryCode,
  type PasswordRecoveryCodeAuth,
} from '../../lib/auth/password-recovery-code'

test('KAN-640 exchanges a recovery code for a server-side Supabase session', async () => {
  const calls: string[] = []
  const auth: PasswordRecoveryCodeAuth = {
    async exchangeCodeForSession(code) {
      calls.push(code)
      return {
        data: {
          session: { access_token: 'token' },
          user: { id: 'supabase-user-1' },
        },
        error: null,
      }
    },
  }

  assert.deepEqual(
    await exchangePasswordRecoveryCode(auth, ' recovery-code '),
    { status: 'verified' },
  )
  assert.deepEqual(calls, ['recovery-code'])
})

test('KAN-640 rejects a missing recovery code without contacting Supabase', async () => {
  let calls = 0
  const auth: PasswordRecoveryCodeAuth = {
    async exchangeCodeForSession() {
      calls += 1
      throw new Error('must not run')
    },
  }

  assert.deepEqual(
    await exchangePasswordRecoveryCode(auth, null),
    { status: 'invalid' },
  )
  assert.equal(calls, 0)
})

test('KAN-640 classifies expired or already-used recovery codes as invalid', async () => {
  const auth: PasswordRecoveryCodeAuth = {
    async exchangeCodeForSession() {
      return {
        data: { session: null, user: null },
        error: { code: 'flow_state_expired' },
      }
    },
  }

  assert.deepEqual(
    await exchangePasswordRecoveryCode(auth, 'expired-code'),
    { status: 'invalid' },
  )
})

test('KAN-640 fails closed on malformed Supabase responses', async () => {
  const auth: PasswordRecoveryCodeAuth = {
    async exchangeCodeForSession() {
      return {
        data: { session: null, user: { id: 'supabase-user-1' } },
        error: null,
      }
    },
  }

  assert.deepEqual(
    await exchangePasswordRecoveryCode(auth, 'code'),
    { status: 'invalid' },
  )
})

test('KAN-640 fails closed on provider exceptions', async () => {
  const auth: PasswordRecoveryCodeAuth = {
    async exchangeCodeForSession() {
      throw new Error('network failure')
    },
  }

  assert.deepEqual(
    await exchangePasswordRecoveryCode(auth, 'code'),
    { status: 'invalid' },
  )
})
