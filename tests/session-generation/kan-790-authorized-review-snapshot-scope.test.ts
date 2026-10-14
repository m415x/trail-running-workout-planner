import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveAuthorizedReviewSnapshotScope,
  type ReviewPlanAuthority,
} from '@/lib/session-generation/authorized-review-snapshot-scope'

const planId = 'plan-base'
const actor = 'user-coach'
const team = 'team-alpha'
const base: ReviewPlanAuthority = { id: planId, groupId: 'group-alpha', teamId: team, planningCohortId: null }
const variant = { ...base, id: 'plan-variant', planningCohortId: 'cohort-alpha' }

type FixtureOptions = {
  authenticatedUserId?: string | null
  activeTeamId?: string | null
  plan?: typeof base | null
  planningAllowed?: boolean
  snapshot?: { id: string; userId: string; teamId: string; groupTrainingPlanId: string; groupId: string; planningCohortId: string | null } | null
}

function fixture(overrides: FixtureOptions = {}) {
  const calls: string[] = []
  const dependencies = {
    authenticate: async () => { calls.push('authenticate'); return overrides.authenticatedUserId === undefined ? actor : overrides.authenticatedUserId },
    resolveActiveTeam: async (_userId: string) => { calls.push('activeTeam'); return overrides.activeTeamId === undefined ? team : overrides.activeTeamId },
    readPlan: async (_planId: string) => { calls.push('readPlan'); return overrides.plan === undefined ? base : overrides.plan },
    authorizePlanning: async (_userId: string, _teamId: string, _groupId: string) => { calls.push('authorize'); return overrides.planningAllowed ?? true },
    readSnapshot: async (_id: string) => { calls.push('readSnapshot'); return overrides.snapshot ?? null },
  }
  return { dependencies, calls }
}

test('KAN-790 T5.1 obtains H2/H3/H4A-authorized Base scope exclusively from server sources', async () => {
  const { dependencies, calls } = fixture()
  const resolved = await resolveAuthorizedReviewSnapshotScope({ groupTrainingPlanId: planId }, dependencies)
  assert.deepEqual(resolved, {
    kind: 'authorized',
    scope: { userId: actor, teamId: team, groupTrainingPlanId: planId, groupId: base.groupId, planningCohortId: null },
  })
  assert.deepEqual(calls, ['authenticate', 'activeTeam', 'readPlan', 'authorize'])
})

test('KAN-790 T5.1 denies anonymous, unresolved Team, wrong Team, missing capability, and nonexistent Plan without writes', async () => {
  const cases: FixtureOptions[] = [
    { authenticatedUserId: null },
    { activeTeamId: null },
    { activeTeamId: 'team-beta' },
    { plan: { ...base, teamId: 'team-beta' } },
    { planningAllowed: false },
    { plan: null },
  ]
  for (const options of cases) {
    const { dependencies, calls } = fixture(options)
    assert.deepEqual(
      await resolveAuthorizedReviewSnapshotScope({ groupTrainingPlanId: planId }, dependencies),
      { kind: 'denied' },
    )
    assert.equal(calls.includes('readSnapshot'), false, 'must not fetch snapshot after authority failure')
  }
})

test('KAN-790 T5.1 binds Variant to its actual Plan/cohort and rejects mismatched snapshot identity', async () => {
  const identity = { id: 'review-id', userId: actor, teamId: team, groupTrainingPlanId: variant.id, groupId: variant.groupId, planningCohortId: variant.planningCohortId }
  const accepted = fixture({ plan: variant, snapshot: identity })
  assert.deepEqual(
    await resolveAuthorizedReviewSnapshotScope({ groupTrainingPlanId: variant.id, snapshotId: identity.id }, accepted.dependencies),
    { kind: 'authorized', scope: { userId: actor, teamId: team, groupTrainingPlanId: variant.id, groupId: variant.groupId, planningCohortId: variant.planningCohortId } },
  )
  for (const change of [
    { userId: 'other-user' },
    { teamId: 'other-team' },
    { groupTrainingPlanId: planId },
    { groupId: 'other-group' },
    { planningCohortId: null },
  ]) {
    const { dependencies } = fixture({ plan: variant, snapshot: { ...identity, ...change } })
    assert.deepEqual(
      await resolveAuthorizedReviewSnapshotScope({ groupTrainingPlanId: variant.id, snapshotId: identity.id }, dependencies),
      { kind: 'denied' },
    )
  }
})
