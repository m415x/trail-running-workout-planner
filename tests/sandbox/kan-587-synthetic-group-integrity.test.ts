import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSyntheticGroupFixtureInventory,
  validateSyntheticGroupFixtureInventory,
} from '../../lib/sandbox/synthetic-group-fixtures'

test('KAN-587/F3 accepts the existing synthetic team and group inventory in memory', () => {
  assert.deepEqual(validateSyntheticGroupFixtureInventory(buildSyntheticGroupFixtureInventory()), { valid: true })
})

test('KAN-587/F3 rejects duplicate team and group primary keys', () => {
  const original = buildSyntheticGroupFixtureInventory()
  assert.throws(
    () => validateSyntheticGroupFixtureInventory({ ...original, teams: [...original.teams, { ...original.teams[0] }] }),
    /duplicate|team|identity/i,
  )
  assert.throws(
    () => validateSyntheticGroupFixtureInventory({ ...original, groups: [...original.groups, { ...original.groups[0] }] }),
    /duplicate|group|identity/i,
  )
})

test('KAN-587/F3 rejects duplicate team/category/level and orphan group references', () => {
  const original = buildSyntheticGroupFixtureInventory()
  assert.throws(
    () => validateSyntheticGroupFixtureInventory({
      ...original,
      groups: [...original.groups, { ...original.groups[0], id: 'sandbox_fixture_group_distinct' }],
    }),
    /duplicate|unique|combination/i,
  )
  assert.throws(
    () => validateSyntheticGroupFixtureInventory({
      ...original,
      groups: [{ ...original.groups[0], teamId: 'sandbox_fixture_team_missing' }, original.groups[1]],
    }),
    /team|reference|orphan/i,
  )
})
