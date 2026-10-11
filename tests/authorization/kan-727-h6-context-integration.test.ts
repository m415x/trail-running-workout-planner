import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-727 H6 payments use canonical H2/H3 writer context instead of a second actor derivation', () => {
  const source = readFileSync('lib/memberships/h6-payment-actions.ts', 'utf8')
  assert.match(source, /import\s*\{\s*resolveAuthorizedH7aWriterContext\s*\}/)
  assert.match(source, /resolveAuthorizedH7aWriterContext\(actor, decision\)/)
  assert.doesNotMatch(source, /authenticatedActorUserId:\s*actor\.userId/)
})
