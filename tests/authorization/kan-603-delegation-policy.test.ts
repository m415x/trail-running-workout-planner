import assert from 'node:assert/strict'
import test from 'node:test'

import {
  evaluateDelegationPolicy,
  type DelegationAuthority,
} from '../../lib/authorization/delegation-policy'

const groupAuthority = (
  source: DelegationAuthority['source'] = 'base',
): DelegationAuthority => ({
  capability: 'training.coordinate',
  scope: 'sporting_group',
  scopeTargetId: 'group-a',
  source,
})

test('KAN-656 allows ADMIN to grant an explicitly delegable non-structural capability', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'training.coordinate',
      requestedScope: 'sporting_group',
      requestedScopeTargetId: 'group-a',
      grantorAuthority: null,
    }).allowed,
    true,
  )
})

test('KAN-656 allows COACH only when the capability is delegable and authority is held from base', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'coach',
      capability: 'training.coordinate',
      requestedScope: 'sporting_group',
      requestedScopeTargetId: 'group-a',
      grantorAuthority: groupAuthority('base'),
    }).allowed,
    true,
  )

  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'coach',
      capability: 'training.coordinate',
      requestedScope: 'sporting_group',
      requestedScopeTargetId: 'group-a',
      grantorAuthority: groupAuthority('grant'),
    }).allowed,
    false,
  )
})

test('KAN-656 denies delegation by ATHLETE and ASSISTANT', () => {
  for (const grantorPreset of ['athlete', 'assistant'] as const) {
    assert.equal(
      evaluateDelegationPolicy({
        grantorPreset,
        capability: 'training.coordinate',
        requestedScope: 'sporting_group',
        requestedScopeTargetId: 'group-a',
        grantorAuthority: groupAuthority(),
      }).allowed,
      false,
    )
  }
})

test('KAN-656 denies non-delegable and structural capabilities', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'planning.manage',
      requestedScope: 'team',
      grantorAuthority: null,
    }).allowed,
    false,
  )

  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'team_membership.manage',
      requestedScope: 'team',
      grantorAuthority: null,
    }).allowed,
    false,
  )
})

test('KAN-656 prevents COACH scope expansion beyond base authority', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'coach',
      capability: 'training.coordinate',
      requestedScope: 'sporting_group',
      requestedScopeTargetId: 'group-b',
      grantorAuthority: groupAuthority(),
    }).allowed,
    false,
  )

  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'coach',
      capability: 'training.coordinate',
      requestedScope: 'team',
      grantorAuthority: groupAuthority(),
    }).allowed,
    false,
  )
})

test('KAN-656 rejects reserved ASSIGNED_ATHLETES as a grant scope', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'training.coordinate',
      requestedScope: 'assigned_athletes',
      requestedScopeTargetId: 'athlete-a',
      grantorAuthority: null,
    }).allowed,
    false,
  )
})

test('KAN-656 rejects malformed target semantics instead of widening scope', () => {
  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'training.coordinate',
      requestedScope: 'sporting_group',
      grantorAuthority: null,
    }).allowed,
    false,
  )

  assert.equal(
    evaluateDelegationPolicy({
      grantorPreset: 'admin',
      capability: 'training.coordinate',
      requestedScope: 'team',
      requestedScopeTargetId: 'group-a',
      grantorAuthority: null,
    }).allowed,
    false,
  )
})
