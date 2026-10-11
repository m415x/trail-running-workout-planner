import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-729 initial and changed athlete terms persist the trusted H2 creator', () => {
  const runtime = readFileSync('lib/memberships/billing-server-action-runtime.ts', 'utf8')
  const service = readFileSync('lib/memberships/athlete-billing-terms-service.ts', 'utf8')
  const repo = readFileSync('lib/memberships/billing-drizzle-write-repository.ts', 'utf8')
  assert.match(runtime, /createdByUserId:\s*input\.authorship\?\.effectiveActorUserId\s*\?\?\s*null/)
  assert.match(service, /createdByUserId:\s*input\.createdByUserId\s*\?\?\s*null/)
  assert.match(repo, /createdByUserId:\s*terms\.createdByUserId\s*\?\?\s*null/)
  assert.match(repo, /createdByUserId:\s*replacement\.createdByUserId\s*\?\?\s*null/)
})
