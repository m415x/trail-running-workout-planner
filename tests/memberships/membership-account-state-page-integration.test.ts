import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs'

test('Coach athlete detail wires localized H4 account projection without recomputing economic rules', () => {
  const source = fs.readFileSync(
    'app/[locale]/dashboard/athletes/[athleteId]/page.tsx',
    'utf8',
  )

  assert.match(source, /MembershipAccountState/)
  assert.match(source, /accountState=\{membership\.accountState\}/)
  assert.match(source, /economicHistory=\{membership\.economicHistory\}/)
  assert.match(source, /membershipAccountTitle/)
  assert.match(source, /membershipTotalBalance/)
  assert.match(source, /membershipEconomicHistory/)

  assert.doesNotMatch(source, /status:\s*['"](?:settled|pending|overdue)['"]/)
  assert.doesNotMatch(source, /remainingMinor\s*[-+]/)
})
