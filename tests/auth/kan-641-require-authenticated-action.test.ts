import assert from 'node:assert/strict'
import test from 'node:test'

import {
  requireAuthenticatedEptAction,
  type RequireAuthenticatedActionDeps,
} from '../../lib/auth/require-authenticated-action'

function depsFor(
  status: 'anonymous' | 'unlinked' | 'authenticated' | 'invalid',
): RequireAuthenticatedActionDeps {
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

test('KAN-641 allows only authenticated EPT identity through direct server actions', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptAction(depsFor('authenticated')),
    {
      status: 'authenticated',
      userId: 'user-1',
    },
  )
})

test('KAN-641 rejects anonymous direct server action invocation fail closed', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptAction(depsFor('anonymous')),
    {
      status: 'forbidden',
      reason: 'anonymous',
    },
  )
})

test('KAN-641 rejects unlinked direct server action invocation distinctly', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptAction(depsFor('unlinked')),
    {
      status: 'forbidden',
      reason: 'unlinked',
    },
  )
})

test('KAN-641 rejects invalid session state for direct server actions', async () => {
  assert.deepEqual(
    await requireAuthenticatedEptAction(depsFor('invalid')),
    {
      status: 'forbidden',
      reason: 'invalid',
    },
  )
})
