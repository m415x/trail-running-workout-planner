import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('KAN-730 global due-date exception derives H2/H3 writer authority before invoking persistence', () => {
  const source = readFileSync('lib/memberships/h6-economic-exception-actions.ts', 'utf8')
  assert.match(source, /resolveAuthorizedH7aWriterContext\(access, result\)/)
  assert.match(source, /deps\.globalDueDate\(context\.teamId, input, context\.authorship\)/)
  assert.doesNotMatch(source, /return result\.allowed && result\.teamId \? result\.teamId : null/)
})

test('KAN-730 reduction and extension preserve trusted H2 author after owned-charge authorization', () => {
  const source = readFileSync('lib/memberships/h6-economic-exception-actions.ts', 'utf8')
  assert.match(source, /deps\.reduce\(context\.teamId, input, context\.authorship\)/)
  assert.match(source, /deps\.extend\(context\.teamId, input, context\.authorship\)/)
  assert.match(source, /deps\.ownsCharge\(context\.teamId, input\.athleteId, input\.monthlyChargeId, input\.year, input\.month\)/)
})
