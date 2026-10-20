import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('KAN-758 dedicated opt-in multi-Team seed does not change existing seed contracts', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { scripts: Record<string, string> }
  assert.equal(pkg.scripts['db:seed:acceptance:multiteam'], 'tsx scripts/provision-multiteam-acceptance.ts')
  // KAN-838 supersedes the historical acceptance chain with a disposable orchestrator.
  // KAN-758 retains its non-delegable contract: multiteam is an explicit opt-in alias.
  assert.equal(pkg.scripts['db:seed:acceptance'], 'tsx scripts/seed-acceptance-disposable.ts')
  assert.equal(pkg.scripts['db:seed:base'], 'tsx db/seeds/base.ts')
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
