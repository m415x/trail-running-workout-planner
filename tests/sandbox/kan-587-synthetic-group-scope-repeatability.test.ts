import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSyntheticGroupFixtureInventory,
  validateSyntheticGroupFixtureInventory,
} from '../../lib/sandbox/synthetic-group-fixtures'

test('KAN-587/F4 permits identical category and level in distinct existing teams', () => {
  const inventory = buildSyntheticGroupFixtureInventory()
  const secondTeam = { id: 'sandbox_fixture_team_beta', name: 'Synthetic Fixture Team Beta' }
  const sameCategoryOtherTeam = {
    ...inventory.groups[0],
    id: 'sandbox_fixture_group_beta_e1',
    teamId: secondTeam.id,
  }
  assert.deepEqual(validateSyntheticGroupFixtureInventory({
    teams: [...inventory.teams, secondTeam],
    groups: [...inventory.groups, sameCategoryOtherTeam],
  }), { valid: true })
})

test('KAN-587/F4 recreates inventory independently after caller mutation', () => {
  const initial = buildSyntheticGroupFixtureInventory()
  const original = buildSyntheticGroupFixtureInventory()
  initial.teams[0] = { id: 'altered_local_only', name: 'Altered' }
  initial.groups.pop()
  assert.deepEqual(buildSyntheticGroupFixtureInventory(), original)
})

test('KAN-587/F4 rejects a group referencing another absent team even if its category/level exists locally', () => {
  const inventory = buildSyntheticGroupFixtureInventory()
  assert.throws(() => validateSyntheticGroupFixtureInventory({
    teams: inventory.teams,
    groups: [{ ...inventory.groups[0], teamId: 'sandbox_fixture_team_elsewhere' }],
  }), /team|reference|orphan/i)
})
