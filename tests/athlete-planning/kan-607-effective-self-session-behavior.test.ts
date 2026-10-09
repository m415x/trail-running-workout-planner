import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveEffectiveSelfSession } from '@/lib/athlete-planning/effective-self-session'

const date = '2026-10-09'
const basePlan = {
  id: 'base', groupId: 'group-a', planningCohortId: null, status: 'active' as const,
  isDeleted: false, macrocycles: [{ startDate: '2026-10-01', endDate: '2026-10-31', isDeleted: false }],
}
const variantPlan = {
  id: 'variant', groupId: 'group-a', planningCohortId: 'cohort-a', status: 'active' as const,
  isDeleted: false, macrocycles: [{ startDate: '2026-10-01', endDate: '2026-10-31', isDeleted: false }],
}
const prescriptions = [
  { id: 'base-prescription', sessionId: 'session-a', groupId: 'group-a', microcycleId: 'micro-base', groupTrainingPlanId: 'base' },
  { id: 'variant-prescription', sessionId: 'session-a', groupId: 'group-a', microcycleId: 'micro-variant', groupTrainingPlanId: 'variant' },
]
function fixture(overrides: Record<string, unknown> = {}) {
  return {
    athleteProfileId: 'athlete-a', athleteId: 'athlete-a', athleteTeamId: 'team-a',
    currentGroupId: 'group-a', groupChanges: [], memberships: [],
    basePlans: [basePlan], sessionId: 'session-a',
    session: { id: 'session-a', teamId: 'team-a', date, isDeleted: false },
    prescriptions,
    ...overrides,
  }
}
const membership = {
  id: 'membership-a', startDate: '2026-10-01', endDate: null, isDeleted: false,
  cohort: {
    id: 'cohort-a', teamId: 'team-a', groupId: 'group-a', status: 'active' as const,
    isDeleted: false, planningVariant: variantPlan,
  },
}

test('KAN-700 resolves Base and Cohort Variant independently without falling back to Base', () => {
  assert.deepEqual(resolveEffectiveSelfSession(fixture()), {
    status: 'resolved', athleteProfileId: 'athlete-a', sessionId: 'session-a', prescriptionId: 'base-prescription',
  })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({ memberships: [membership] })), {
    status: 'resolved', athleteProfileId: 'athlete-a', sessionId: 'session-a', prescriptionId: 'variant-prescription',
  })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({
    memberships: [membership],
    prescriptions: [prescriptions[0]],
  })), { status: 'denied' })
})

test('KAN-700 rejects a prescription attached to a DIFFERENT session even if Team and effective plan match', () => {
  assert.deepEqual(resolveEffectiveSelfSession(fixture({
    prescriptions: [{ ...prescriptions[0], sessionId: 'session-b' }],
  })), { status: 'denied' })
})

test('KAN-700 denies tampered SELF, Team, date and prescription locators', () => {
  assert.deepEqual(resolveEffectiveSelfSession(fixture({ athleteProfileId: 'athlete-b' })), { status: 'denied' })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({ sessionId: 'session-b' })), { status: 'denied' })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({
    session: { id: 'session-a', teamId: 'team-b', date, isDeleted: false },
  })), { status: 'denied' })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({ prescriptionId: 'variant-prescription' })), { status: 'denied' })
  assert.deepEqual(resolveEffectiveSelfSession(fixture({
    session: { id: 'session-a', teamId: 'team-a', date: '2026-11-10', isDeleted: false },
  })), { status: 'denied' })
})

test('KAN-700 DENY on conflicting dated group memberships rather than arbitrarily choosing', () => {
  assert.deepEqual(resolveEffectiveSelfSession(fixture({
    memberships: [membership, { ...membership, id: 'membership-b' }],
  })), { status: 'denied' })
})
