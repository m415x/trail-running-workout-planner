import assert from 'node:assert/strict'
import test from 'node:test'

import {
  requestPasswordRecovery,
  type PasswordRecoveryRequestAuth,
} from '../../lib/auth/password-recovery-request'

test('KAN-640 sends a localized recovery callback without exposing account existence', async () => {
  const calls: Array<{ email: string; redirectTo: string }> = []
  const auth: PasswordRecoveryRequestAuth = {
    async resetPasswordForEmail(email, options) {
      calls.push({ email, redirectTo: options.redirectTo })
      return { data: {}, error: null }
    },
  }

  const result = await requestPasswordRecovery({
    auth,
    email: ' coach@example.com ',
    locale: 'es',
    origin: 'https://app.example.com',
  })

  assert.deepEqual(result, { status: 'accepted' })
  assert.deepEqual(calls, [{
    email: 'coach@example.com',
    redirectTo: 'https://app.example.com/es/auth/recovery/callback',
  }])
})

test('KAN-640 uses the English localized callback when requested', async () => {
  let redirectTo = ''
  const auth: PasswordRecoveryRequestAuth = {
    async resetPasswordForEmail(_email, options) {
      redirectTo = options.redirectTo
      return { data: {}, error: null }
    },
  }

  assert.deepEqual(
    await requestPasswordRecovery({
      auth,
      email: 'coach@example.com',
      locale: 'en',
      origin: 'https://app.example.com/',
    }),
    { status: 'accepted' },
  )
  assert.equal(redirectTo, 'https://app.example.com/en/auth/recovery/callback')
})

test('KAN-640 keeps the public result non-enumerative when Supabase accepts the request', async () => {
  const auth: PasswordRecoveryRequestAuth = {
    async resetPasswordForEmail() {
      return { data: {}, error: null }
    },
  }

  const existing = await requestPasswordRecovery({
    auth,
    email: 'existing@example.com',
    locale: 'es',
    origin: 'https://app.example.com',
  })
  const unknown = await requestPasswordRecovery({
    auth,
    email: 'unknown@example.com',
    locale: 'es',
    origin: 'https://app.example.com',
  })

  assert.deepEqual(existing, { status: 'accepted' })
  assert.deepEqual(unknown, { status: 'accepted' })
})

test('KAN-640 returns a generic technical failure without account-enumeration semantics', async () => {
  const auth: PasswordRecoveryRequestAuth = {
    async resetPasswordForEmail() {
      return {
        data: {},
        error: { code: 'over_email_send_rate_limit' },
      }
    },
  }

  assert.deepEqual(
    await requestPasswordRecovery({
      auth,
      email: 'coach@example.com',
      locale: 'es',
      origin: 'https://app.example.com',
    }),
    { status: 'error' },
  )
})

test('KAN-640 rejects malformed origins fail closed before calling Supabase', async () => {
  let calls = 0
  const auth: PasswordRecoveryRequestAuth = {
    async resetPasswordForEmail() {
      calls += 1
      return { data: {}, error: null }
    },
  }

  assert.deepEqual(
    await requestPasswordRecovery({
      auth,
      email: 'coach@example.com',
      locale: 'es',
      origin: 'javascript:alert(1)',
    }),
    { status: 'error' },
  )
  assert.equal(calls, 0)
})
