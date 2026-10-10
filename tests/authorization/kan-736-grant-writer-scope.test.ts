import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-736 classifies grant provenance without claiming undeployed grant mutations', () => {
  const schema = readFileSync('db/schema.ts', 'utf8')
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  assert.match(schema, /grantedByUserId:/)
  assert.match(schema, /revokedByUserId:/)
  assert.match(inventory, /no deployed grant mutation writer/)
  assert.match(inventory, /Grant writer deployment decision: no verified production mutation entrypoint/)
})
