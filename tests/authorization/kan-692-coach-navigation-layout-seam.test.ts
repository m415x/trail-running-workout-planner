import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const layout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
const shell = readFileSync('app/[locale]/dashboard/DashboardShell.tsx', 'utf8')
const serverFactory = readFileSync('lib/authorization/h4a-next-server-authorization.ts', 'utf8')

test('KAN-692 server layout projects Coach links from authenticated H2 identity and active Team', () => {
  assert.match(layout, /createCoachNavigationNextServerProjection/)
  assert.match(layout, /access\.userId/)
  assert.match(layout, /visibleDestinations=\{visibleDestinations\}/)
  assert.doesNotMatch(layout, /team_1|TEAM_MEMBERSHIP_PRESETS/)
})

test('KAN-692 shell accepts a serializable allowlist and delegates to sidebar without deriving authority', () => {
  assert.match(shell, /visibleDestinations:\s*readonly string\[\]/)
  assert.match(shell, /<AppSidebar visibleDestinations=\{visibleDestinations\}/)
  assert.doesNotMatch(shell, /TEAM_MEMBERSHIP_PRESETS|authorizationGrants/)
})

test('KAN-692 Next server adapter exposes reusable H3 evidence loader for batch projection', () => {
  assert.match(serverFactory, /export function createH4aNextServerEvidenceSource/)
})
