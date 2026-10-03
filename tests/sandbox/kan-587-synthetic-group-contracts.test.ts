import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSyntheticGroupFixtureInventory,
  validateSyntheticGroupFixtureTarget,
} from '../../lib/sandbox/synthetic-group-fixtures'

test('KAN-587/F1 deterministic synthetic team and group identity matches PostgreSQL schema keys', () => {
  const first = buildSyntheticGroupFixtureInventory()
  const next = buildSyntheticGroupFixtureInventory()
  assert.deepEqual(first, next)
  assert.equal(first.teams.length, 1)
  assert.equal(first.groups.length, 2)
  const team = first.teams[0]
  assert.match(team.id, /^sandbox_fixture_/)
  assert.match(team.name, /synthetic|fixture/i)
  assert.deepEqual(Object.keys(team).sort(), ['id', 'name'])
  assert.equal(new Set(first.groups.map(group => group.id)).size, first.groups.length)
  assert.ok(first.groups.every(group => group.teamId === team.id))
  assert.ok(first.groups.every(group => ['E', 'U', 'M', 'H', 'S', 'B'].includes(group.categoryCode)))
  assert.ok(first.groups.every(group => ['1', '2', '3'].includes(group.levelCode)))
  assert.ok(first.groups.every(group => Object.keys(group).sort().join(',') === 'categoryCode,id,levelCode,teamId'))
  assert.equal(new Set(first.groups.map(group => [group.teamId, group.categoryCode, group.levelCode].join(':'))).size, first.groups.length)
})

test('KAN-587/F2 rejects off-target, cloud and missing destinations before any persistence', () => {
  const safe = 'postgresql://postgres:fixture-not-a-secret@127.0.0.1:54322/postgres'
  assert.deepEqual(validateSyntheticGroupFixtureTarget(safe), {
    kind: 'local', host: '127.0.0.1', port: 54322, database: 'postgres',
  })
  for (const target of [
    undefined,
    'postgresql://postgres:fixture-not-a-secret@localhost:54322/postgres',
    'postgresql://postgres:fixture-not-a-secret@127.0.0.1:54323/postgres',
    'postgresql://postgres:fixture-not-a-secret@db.example.supabase.co:5432/postgres',
  ]) {
    assert.throws(() => validateSyntheticGroupFixtureTarget(target), /local|sandbox|endpoint|url/i)
  }
})
