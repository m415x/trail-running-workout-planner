import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-735 does not claim audited TeamMembership revocation without a deployed H2/H3 writer', () => {
  const writer = readFileSync('lib/identity/team-membership-lifecycle.ts', 'utf8')
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  assert.match(writer, /export function revokeTeamMembership/)
  assert.match(writer, /\.update\(teamMemberships\)/)
  assert.match(inventory, /Production caller evidence for revokeTeamMembership: none found/)
  assert.match(inventory, /no authenticated actor, revocation author or reason/)
  assert.match(inventory, /A deployed authenticated caller was \*\*not verified/)
})

test('KAN-735 grants remain a separate historical authority contract', () => {
  const inventory = readFileSync('docs/architecture/h7a-sensitive-writer-inventory.md', 'utf8')
  assert.match(inventory, /authorizationGrants/)
  assert.match(inventory, /grantedByUserId/)
  assert.match(inventory, /revokedByUserId/)
})
