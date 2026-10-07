import assert from 'node:assert/strict'
import test from 'node:test'

import {
  completePasswordRecovery,
  type PasswordRecoveryUpdateAuth,
} from '../../lib/auth/password-recovery-update'

test('KAN-640 updates the password and signs out the recovery session', async () => {
  const calls: string[] = []
  const auth: PasswordRecoveryUpdateAuth = {
    async updateUser(input) {
      calls.push(`update:${input.password}`)
      return {
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      }
    },
    async signOut() {
      calls.push('signout')
      return { error: null }
    },
  }

  assert.deepEqual(
    await completePasswordRecovery(auth, ' new-password-123 '),
    { status: 'updated' },
  )
  assert.deepEqual(calls, ['update:new-password-123', 'signout'])
})

test('KAN-640 rejects an empty password before contacting Supabase', async () => {
  let calls = 0
  const auth: PasswordRecoveryUpdateAuth = {
    async updateUser() {
      calls += 1
      throw new Error('must not run')
    },
    async signOut() {
      calls += 1
      return { error: null }
    },
  }

  assert.deepEqual(
    await completePasswordRecovery(auth, '   '),
    { status: 'invalid' },
  )
  assert.equal(calls, 0)
})

test('KAN-640 fails closed when Supabase rejects the password update', async () => {
  let signOutCalls = 0
  const auth: PasswordRecoveryUpdateAuth = {
    async updateUser() {
      return {
        data: { user: null },
        error: { code: 'same_password' },
      }
    },
    async signOut() {
      signOutCalls += 1
      return { error: null }
    },
  }

  assert.deepEqual(
    await completePasswordRecovery(auth, 'new-password-123'),
    { status: 'invalid' },
  )
  assert.equal(signOutCalls, 0)
})

test('KAN-640 fails closed when the recovery session has expired before update', async () => {
  const auth: PasswordRecoveryUpdateAuth = {
    async updateUser() {
      return {
        data: { user: null },
        error: { code: 'session_not_found' },
      }
    },
    async signOut() {
      return { error: null }
    },
  }

  assert.deepEqual(
    await completePasswordRecovery(auth, 'new-password-123'),
    { status: 'invalid' },
  )
})

test('KAN-640 treats sign-out failure after password update as invalid', async () => {
  const auth: PasswordRecoveryUpdateAuth = {
    async updateUser() {
      return {
        data: { user: { id: 'supabase-user-1' } },
        error: null,
      }
    },
    async signOut() {
      return { error: { code: 'signout_failed' } }
    },
  }

  assert.deepEqual(
    await completePasswordRecovery(auth, 'new-password-123'),
    { status: 'invalid' },
  )
})
