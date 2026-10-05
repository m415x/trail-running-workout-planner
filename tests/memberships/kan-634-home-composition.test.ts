import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/[locale]/(mobile)/page.tsx', 'utf8')
const client = readFileSync('app/[locale]/(mobile)/HomeTabClient.tsx', 'utf8')

test('KAN-634 Home reads one real account snapshot with the server civil date and same athlete scope', () => {
  assert.match(page, /createAthleteHomeEconomicSqliteReader/)
  assert.match(page, /createDrizzleBillingDatabase\(db\)/)
  assert.match(page, /athleteProfile\.teamId/)
  assert.match(page, /athleteProfile\.id/)
  assert.match(page, /cutoffDate:/)
  assert.match(page, /economicState=/)
  assert.doesNotMatch(page, /new Date\(\).*getDate\(/)
})

test('KAN-634 Home client maps H4\/H5 once into textual notice and resets the shell on navigation', () => {
  assert.match(client, /projectAthleteEconomicVisualState/)
  assert.match(client, /resolveAthleteEconomicShellBackground/)
  assert.match(client, /<AthleteHomeEconomicNotice/)
  assert.match(client, /setShellBgColor\('bg-background'\)/)
  assert.match(client, /return \(\) => setShellBgColor\('bg-background'\)/)
})
