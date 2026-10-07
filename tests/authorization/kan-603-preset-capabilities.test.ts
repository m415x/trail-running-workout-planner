import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAPABILITY_CATALOG,
  TEAM_MEMBERSHIP_PRESETS,
  getCapabilityDefinition,
} from '../../lib/authorization/capability-catalog'

test('KAN-654 exposes four independent TeamMembership presets', () => {
  assert.deepEqual(
    [...TEAM_MEMBERSHIP_PRESETS].sort(),
    ['admin', 'assistant', 'athlete', 'coach'],
  )
})

test('KAN-654 models capability base authority as an explicit preset set', () => {
  for (const capability of CAPABILITY_CATALOG) {
    assert.ok(Array.isArray(capability.basePresets))
    assert.ok(capability.basePresets.length > 0)
    assert.equal('basePreset' in capability, false)
  }

  assert.deepEqual(
    [...getCapabilityDefinition('athlete.admin.manage').basePresets].sort(),
    ['admin', 'assistant', 'coach'],
  )
})

test('KAN-654 keeps presets non-hierarchical across sensitive domains', () => {
  const planning = getCapabilityDefinition('planning.manage')
  const physiology = getCapabilityDefinition('physiology.read')
  const fieldEvidence = getCapabilityDefinition('field_evidence_1000m.manage')

  assert.deepEqual(planning.basePresets, ['coach'])
  assert.deepEqual(physiology.basePresets, ['coach'])
  assert.deepEqual(fieldEvidence.basePresets, ['coach'])

  for (const capability of [planning, physiology, fieldEvidence]) {
    assert.equal(capability.basePresets.includes('assistant'), false)
    assert.equal(capability.basePresets.includes('admin'), false)
  }
})

test('KAN-654 makes structural capabilities non-delegable and delegation opt-in', () => {
  const structural = CAPABILITY_CATALOG.filter((capability) => capability.structural)
  assert.ok(structural.length > 0)

  for (const capability of structural) {
    assert.equal(capability.delegable, false)
  }

  assert.equal(
    getCapabilityDefinition('team_membership.manage').structural,
    true,
  )
  assert.equal(
    getCapabilityDefinition('team_membership.manage').delegable,
    false,
  )

  assert.equal(
    getCapabilityDefinition('training.coordinate').delegable,
    true,
  )
})
