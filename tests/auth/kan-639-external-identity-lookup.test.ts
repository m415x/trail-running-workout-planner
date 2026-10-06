import assert from 'node:assert/strict'
import test from 'node:test'

import { createExternalIdentityLookup } from '../../lib/auth/external-identity-lookup'

test('KAN-639 maps persisted external identity rows into the session identity lookup contract', async () => {
  const calls: Array<{ provider: string; subject: string }> = []

  const lookup = createExternalIdentityLookup({
    async findByProviderSubject(provider, subject) {
      calls.push({ provider, subject })
      return [{
        linkId: 'link-1',
        userId: 'user-1',
        linkIsDeleted: false,
        userIsDeleted: false,
      }]
    },
  })

  assert.deepEqual(
    await lookup.findByProviderSubject('supabase', 'subject-1'),
    [{
      linkId: 'link-1',
      userId: 'user-1',
      linkIsDeleted: false,
      userIsDeleted: false,
    }],
  )
  assert.deepEqual(calls, [{ provider: 'supabase', subject: 'subject-1' }])
})

test('KAN-639 Drizzle lookup filters by provider and subject and joins the linked EPT User', () => {
  const source = require('node:fs').readFileSync(
    'lib/auth/external-identity-lookup.ts',
    'utf8',
  )

  assert.match(source, /externalIdentityLinks/)
  assert.match(source, /users/)
  assert.match(source, /eq\(externalIdentityLinks\.provider/)
  assert.match(source, /eq\(externalIdentityLinks\.subject/)
  assert.match(source, /eq\(externalIdentityLinks\.isDeleted, false\)/)
  assert.match(source, /eq\(users\.isDeleted, false\)/)
  assert.match(source, /innerJoin\(users/)
  assert.doesNotMatch(source, /email|dni/i)
})
