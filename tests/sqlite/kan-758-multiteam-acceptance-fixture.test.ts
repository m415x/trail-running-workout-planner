import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('KAN-758 dedicated opt-in multi-Team seed does not change existing seed contracts', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { scripts: Record<string, string> }
  assert.equal(pkg.scripts['db:seed:acceptance:multiteam'], 'tsx scripts/provision-multiteam-acceptance.ts')
  assert.equal(pkg.scripts['db:seed:acceptance'], 'pn db:seed:base && pn exec tsx scripts/provision-h4b-acceptance-actors.ts --apply')
  assert.doesNotMatch(pkg.scripts['db:seed'], /multiteam/)
})

test('KAN-758 multi-Team fixture reuses existing EPT actor and fails closed on collisions', () => {
  const source = readFileSync(resolve('scripts/provision-multiteam-acceptance.ts'), 'utf8')
  assert.match(source, /team_2/)
  assert.match(source, /team_1/)
  assert.match(source, /accept_h4b_athlete/)
  assert.match(source, /team_memberships/)
  assert.match(source, /foreign_key_check/)
  assert.match(source, /--database/)
  assert.match(source, /--apply/)
  assert.doesNotMatch(source, /INSERT INTO (?:users|external_identity_links|athlete_profiles)/i)
})
