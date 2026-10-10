import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-726 identifies organization write helpers', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  const names = ['team-membership-lifecycle.ts', 'external-identity-link.ts']
  for (const name of names) {
    assert.ok(inventory.includes(name), 'Missing identity writer: ' + name)
  }
})
