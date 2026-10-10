import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-728 membership revocation must carry trusted H2 authorship into the durable writer', () => {
  const source = readFileSync('lib/identity/team-membership-lifecycle.ts', 'utf8')
  assert.match(source, /authenticatedActorUserId/, 'revocation must receive the verified H2 actor')
  assert.match(source, /revokedByUserId|changedByUserId/, 'revocation must persist factual authorship')
})
