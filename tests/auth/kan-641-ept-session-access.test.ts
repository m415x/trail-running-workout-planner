import assert from 'node:assert/strict'
import test from 'node:test'

import {
  readEptSessionAccessState,
  type EptSessionAccessAuth,
} from '../../lib/auth/ept-session-access'
import type { ExternalIdentityLookup } from '../../lib/auth/server-session-identity'

function authAnonymous(): EptSessionAccessAuth {
  return {
    async getClaims() {
      return {
        data: null,
        error: { name: 'AuthSessionMissingError' },
      }
    },
    async getUser() {
      throw new Error('getUser must not run for anonymous session')
    },
  }
}

function authVerified(subject = 'supabase-user-1'): EptSessionAccessAuth {
  return {
    async getClaims() {
      return {
        data: { claims: { sub: subject } },
        error: null,
      }
    },
    async getUser() {
      return {
        data: { user: { id: subject } },
        error: null,
      }
    },
  }
}

const emptyLookup: ExternalIdentityLookup = {
  async findByProviderSubject() {
    return []
  },
}

test('KAN-641 classifies absent Supabase session as anonymous', async () => {
  assert.deepEqual(
    await readEptSessionAccessState(authAnonymous(), emptyLookup),
    { status: 'anonymous' },
  )
})

test('KAN-641 classifies verified but unlinked Supabase identity as unlinked', async () => {
  assert.deepEqual(
    await readEptSessionAccessState(authVerified(), emptyLookup),
    {
      status: 'unlinked',
      provider: 'supabase',
      subject: 'supabase-user-1',
    },
  )
})

test('KAN-641 resolves a verified linked identity to authenticated EPT user', async () => {
  const lookup: ExternalIdentityLookup = {
    async findByProviderSubject(provider, subject) {
      assert.equal(provider, 'supabase')
      assert.equal(subject, 'supabase-user-1')
      return [{
        linkId: 'link-1',
        userId: 'ept-user-1',
        linkIsDeleted: false,
        userIsDeleted: false,
      }]
    },
  }

  assert.deepEqual(
    await readEptSessionAccessState(authVerified(), lookup),
    {
      status: 'authenticated',
      provider: 'supabase',
      subject: 'supabase-user-1',
      userId: 'ept-user-1',
    },
  )
})

test('KAN-641 fails closed for expired or revoked Supabase sessions', async () => {
  const expired: EptSessionAccessAuth = {
    async getClaims() {
      return {
        data: null,
        error: { code: 'session_expired' },
      }
    },
    async getUser() {
      throw new Error('getUser must not run after expired claims')
    },
  }

  const revoked = authVerified()
  revoked.getUser = async () => ({
    data: { user: null },
    error: { code: 'session_not_found' },
  })

  assert.deepEqual(
    await readEptSessionAccessState(expired, emptyLookup),
    { status: 'invalid' },
  )
  assert.deepEqual(
    await readEptSessionAccessState(revoked, emptyLookup),
    { status: 'invalid' },
  )
})

test('KAN-641 fails closed for malformed session or ambiguous persistence state', async () => {
  const lookup: ExternalIdentityLookup = {
    async findByProviderSubject() {
      return [
        {
          linkId: 'link-1',
          userId: 'user-1',
          linkIsDeleted: false,
          userIsDeleted: false,
        },
        {
          linkId: 'link-2',
          userId: 'user-2',
          linkIsDeleted: false,
          userIsDeleted: false,
        },
      ]
    },
  }

  assert.deepEqual(
    await readEptSessionAccessState(authVerified(), lookup),
    { status: 'invalid' },
  )
})
