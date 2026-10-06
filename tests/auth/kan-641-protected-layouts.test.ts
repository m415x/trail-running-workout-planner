import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const dashboardLayout = readFileSync('app/[locale]/dashboard/layout.tsx', 'utf8')
const mobileLayout = readFileSync('app/[locale]/(mobile)/layout.tsx', 'utf8')

for (const [name, source] of [
  ['coach dashboard', dashboardLayout],
  ['athlete mobile', mobileLayout],
] as const) {
  test(`KAN-641 ${name} layout protects the server tree with the H2 boundary`, () => {
    assert.doesNotMatch(source, /^['"]use client['"]/)
    assert.match(source, /createSupabaseServerClient/)
    assert.match(source, /createExternalIdentityLookup/)
    assert.match(source, /readEptSessionAccessState/)
    assert.match(source, /requireAuthenticatedEptSession/)
    assert.match(source, /redirect\(/)
  })

  test(`KAN-641 ${name} layout distinguishes unlinked from anonymous login redirect`, () => {
    assert.match(source, /access\.status\s*===\s*['"]unlinked['"]/)
    assert.match(source, /auth\/unlinked/)
  })
}

test('KAN-641 protected layouts preserve their existing client shells behind the server guard', () => {
  assert.match(dashboardLayout, /DashboardShell/)
  assert.match(mobileLayout, /MobileShell/)
})
