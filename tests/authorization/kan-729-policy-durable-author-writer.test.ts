import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 policy runtime persists H2 author with the policy version transaction', () => {
  const runtime = readFileSync('lib/memberships/billing-server-action-runtime.ts', 'utf8')
  const repository = readFileSync('lib/memberships/billing-drizzle-write-repository.ts', 'utf8')
  assert.match(runtime, /createdByUserId:\s*input\.authorship\.effectiveActorUserId/)
  assert.match(repository, /createdByUserId:\s*policy\.createdByUserId/)
  assert.match(repository, /createdByUserId:\s*replacement\.createdByUserId/)
  assert.match(runtime, /transaction\(\(\) =>/)
})
