import assert from 'node:assert/strict'
import test from 'node:test'

import { CAPABILITY_CATALOG, getCapabilityDefinition, type CapabilityKey } from '@/lib/authorization/capability-catalog'
import { authorizeEffectiveCapability } from '@/lib/authorization/effective-authorization'
import type { EffectiveAuthorizationInput } from '@/lib/authorization/effective-authorization'

const SELF_KEYS = ['planning.self.read', 'workout_log.self.manage'] as const
const PRESETS = ['athlete', 'assistant', 'coach', 'admin'] as const

function input(
  capability: CapabilityKey,
  preset: typeof PRESETS[number],
  overrides: Partial<EffectiveAuthorizationInput> = {},
): EffectiveAuthorizationInput {
  return {
    authenticatedUserId: 'ept-user-1',
    teamId: 'team-a',
    capability,
    resource: { teamId: 'team-a', athleteProfileId: 'athlete-a' },
    at: '2026-10-08T12:00:00.000Z',
    memberships: [{
      userId: 'ept-user-1',
      teamId: 'team-a',
      preset,
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveUntil: null,
      isActive: true,
    }],
    athleteProfiles: [{ id: 'athlete-a', userId: 'ept-user-1', teamId: 'team-a' }],
    grants: [],
    requiredScope: 'self',
    ...overrides,
  }
}

test('KAN-697 catalog defines separate nondelegable SELF-only planning and WorkoutLog capabilities', () => {
  for (const key of SELF_KEYS) {
    const definition = CAPABILITY_CATALOG.find(candidate => candidate.key === (key as string))
    assert.ok(definition, `Missing H5A capability ${key}`)
    assert.equal(definition.delegable, false)
    assert.equal(definition.structural, false)
    assert.deepEqual([...definition.basePresets], [...PRESETS])
    // Explicit SELF-only constraint is part of the capability contract, not
    // a client-supplied requiredScope or a default TEAM grant.
    assert.equal((definition as { requiredScope?: string }).requiredScope, 'self')
  }
})

test('KAN-697 SELF access requires matching persisted AthleteProfile for every organizational preset', () => {
  for (const key of SELF_KEYS) {
    const capability = key as CapabilityKey
    for (const preset of PRESETS) {
      assert.equal(authorizeEffectiveCapability(input(capability, preset)).allowed, true, `${key}/${preset} own profile`)
      assert.equal(authorizeEffectiveCapability(input(capability, preset, { athleteProfiles: [] })).allowed, false, `${key}/${preset} no profile`)
      assert.equal(authorizeEffectiveCapability(input(capability, preset, {
        athleteProfiles: [{ id: 'athlete-a', userId: 'ept-user-1', teamId: 'team-b' }],
      })).allowed, false, `${key}/${preset} profile wrong team`)
      assert.equal(authorizeEffectiveCapability(input(capability, preset, {
        resource: { teamId: 'team-a', athleteProfileId: 'athlete-other' },
      })).allowed, false, `${key}/${preset} another athlete`)
    }
  }
})

test('KAN-697 SELF is never promoted to TEAM, and missing/revoked/ambiguous membership denies', () => {
  for (const key of SELF_KEYS) {
    const capability = key as CapabilityKey
    assert.equal(authorizeEffectiveCapability(input(capability, 'coach', {
      requiredScope: 'team',
      resource: { teamId: 'team-a', athleteProfileId: 'athlete-other' },
    })).allowed, false, `${key} must not acquire TEAM scope`)
    assert.equal(authorizeEffectiveCapability(input(capability, 'athlete', { memberships: [] })).allowed, false)
    const base = input(capability, 'athlete')
    assert.equal(authorizeEffectiveCapability(input(capability, 'athlete', {
      memberships: [{ ...base.memberships[0]!, isActive: false }],
    })).allowed, false)
    assert.equal(authorizeEffectiveCapability(input(capability, 'athlete', {
      memberships: [base.memberships[0]!, base.memberships[0]!],
    })).allowed, false)
  }
})

// Force the approved keys to be resolvable through the public catalog lookup,
// rather than accepting an accidentally permissive fallback.
test('KAN-697 exact SELF capability keys resolve through H3 catalog API', () => {
  for (const key of SELF_KEYS) {
    assert.equal(getCapabilityDefinition(key as CapabilityKey).key, key)
  }
})
