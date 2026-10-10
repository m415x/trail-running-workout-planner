import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-738 external identity helper has explicit undeployed and provider-trust boundaries', () => {
  const source = readFileSync('lib/identity/external-identity-link.ts', 'utf8')
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  assert.match(source, /return database\.transaction\(/)
  assert.match(source, /External identity collision/)
  assert.match(source, /does not authenticate a provider session/)
  assert.match(inventory, /Production caller evidence for associateAuthorizedExternalIdentity: none found/)
  assert.match(inventory, /External identity writer deployment decision: no verified authenticated caller/)
})
