import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readVerifiedSupabaseSubject,
  type SupabaseClaimsAuth,
} from '../../lib/auth/supabase-verified-subject'

test('KAN-638 resolves verified Supabase claims to the external subject used by the EPT identity boundary', async () => {
  const auth: SupabaseClaimsAuth = {
    async getClaims() {
      return {
        data: {
          claims: {
            sub: 'supabase-user-123',
          },
        },
        error: null,
      }
    },
  }

  const result = await readVerifiedSupabaseSubject(auth)

  assert.deepEqual(result, {
    status: 'verified',
    externalSubject: {
      provider: 'supabase',
      subject: 'supabase-user-123',
    },
  })
})

test('KAN-638 fails closed when verified claims are missing a usable subject', async () => {
  for (const sub of [undefined, null, '', '   ']) {
    const auth: SupabaseClaimsAuth = {
      async getClaims() {
        return {
          data: {
            claims: { sub },
          },
          error: null,
        }
      },
    }

    assert.deepEqual(
      await readVerifiedSupabaseSubject(auth),
      { status: 'invalid' },
    )
  }
})

test('KAN-638 fails closed when Supabase rejects or cannot verify the current token', async () => {
  const auth: SupabaseClaimsAuth = {
    async getClaims() {
      return {
        data: null,
        error: new Error('token expired or revoked'),
      }
    },
  }

  assert.deepEqual(
    await readVerifiedSupabaseSubject(auth),
    { status: 'invalid' },
  )
})

test('KAN-638 fails closed when claims verification itself throws', async () => {
  const auth: SupabaseClaimsAuth = {
    async getClaims() {
      throw new Error('auth unavailable')
    },
  }

  assert.deepEqual(
    await readVerifiedSupabaseSubject(auth),
    { status: 'invalid' },
  )
})

test('KAN-638 verifies identity with getClaims and never trusts getSession', async () => {
  let claimsCalls = 0
  let sessionCalls = 0

  const auth = {
    async getClaims() {
      claimsCalls += 1
      return {
        data: {
          claims: {
            sub: 'verified-subject',
          },
        },
        error: null,
      }
    },
    async getSession() {
      sessionCalls += 1
      throw new Error('getSession must not be used as identity proof')
    },
  }

  const result = await readVerifiedSupabaseSubject(auth)

  assert.equal(result.status, 'verified')
  assert.equal(claimsCalls, 1)
  assert.equal(sessionCalls, 0)
})
