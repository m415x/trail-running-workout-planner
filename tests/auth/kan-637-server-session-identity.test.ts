import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveAuthenticatedEptIdentity,
  type ExternalIdentityLookup,
} from '../../lib/auth/server-session-identity'

function lookupReturning(
  rows: Awaited<ReturnType<ExternalIdentityLookup['findByProviderSubject']>>,
): ExternalIdentityLookup {
  return {
    async findByProviderSubject() {
      return rows
    },
  }
}

test('KAN-637 resolves absence of provider session as anonymous without consulting identity links', async () => {
  let consulted = false
  const lookup: ExternalIdentityLookup = {
    async findByProviderSubject() {
      consulted = true
      return []
    },
  }

  const result = await resolveAuthenticatedEptIdentity(null, lookup)

  assert.deepEqual(result, { status: 'anonymous' })
  assert.equal(consulted, false)
})

test('KAN-637 keeps a valid external subject without an ExternalIdentityLink as unlinked', async () => {
  const result = await resolveAuthenticatedEptIdentity(
    { provider: 'supabase', subject: 'auth-subject-unlinked' },
    lookupReturning([]),
  )

  assert.deepEqual(result, {
    status: 'unlinked',
    provider: 'supabase',
    subject: 'auth-subject-unlinked',
  })
})

test('KAN-637 resolves one valid ExternalIdentityLink to the stable EPT User', async () => {
  const result = await resolveAuthenticatedEptIdentity(
    { provider: 'supabase', subject: 'auth-subject-linked' },
    lookupReturning([
      {
        linkId: 'link-1',
        userId: 'user-ept-1',
        linkIsDeleted: false,
        userIsDeleted: false,
      },
    ]),
  )

  assert.deepEqual(result, {
    status: 'authenticated',
    provider: 'supabase',
    subject: 'auth-subject-linked',
    userId: 'user-ept-1',
  })
})

test('KAN-637 fails closed when the persisted identity link is invalid or revoked', async () => {
  for (const rows of [
    [
      {
        linkId: 'link-deleted',
        userId: 'user-ept-1',
        linkIsDeleted: true,
        userIsDeleted: false,
      },
    ],
    [
      {
        linkId: 'link-user-deleted',
        userId: 'user-ept-1',
        linkIsDeleted: false,
        userIsDeleted: true,
      },
    ],
  ]) {
    const result = await resolveAuthenticatedEptIdentity(
      { provider: 'supabase', subject: 'auth-subject-invalid' },
      lookupReturning(rows),
    )

    assert.deepEqual(result, { status: 'invalid' })
  }
})

test('KAN-637 fails closed on provider+subject collision instead of choosing an EPT User', async () => {
  const result = await resolveAuthenticatedEptIdentity(
    { provider: 'supabase', subject: 'auth-subject-collision' },
    lookupReturning([
      {
        linkId: 'link-a',
        userId: 'user-ept-a',
        linkIsDeleted: false,
        userIsDeleted: false,
      },
      {
        linkId: 'link-b',
        userId: 'user-ept-b',
        linkIsDeleted: false,
        userIsDeleted: false,
      },
    ]),
  )

  assert.deepEqual(result, { status: 'invalid' })
})

test('KAN-637 fails closed on malformed authenticated subject without consulting fallback identity data', async () => {
  let consulted = false
  const lookup: ExternalIdentityLookup = {
    async findByProviderSubject() {
      consulted = true
      return []
    },
  }

  const result = await resolveAuthenticatedEptIdentity(
    { provider: 'supabase', subject: '   ' },
    lookup,
  )

  assert.deepEqual(result, { status: 'invalid' })
  assert.equal(consulted, false)
})

test('KAN-637 fails closed when identity-link lookup fails', async () => {
  const lookup: ExternalIdentityLookup = {
    async findByProviderSubject() {
      throw new Error('database unavailable')
    },
  }

  const result = await resolveAuthenticatedEptIdentity(
    { provider: 'supabase', subject: 'auth-subject-error' },
    lookup,
  )

  assert.deepEqual(result, { status: 'invalid' })
})
