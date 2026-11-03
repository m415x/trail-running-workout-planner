import assert from 'node:assert/strict'
import test from 'node:test'

import { createCoachPlanningListOperation } from '@/lib/planning/coach-planning-list-operation'
import { projectCoachHomePlanning } from '@/lib/coach-home/planning-summary'

test('KAN-866/T3 loads Plan collection once for N visible Plans and bounds Home output', async () => {
  const count = { listGroups: 0, listPlans: 0, authorize: 0, authorizePlan: 0 }
  const planItems = Array.from({ length: 24 }, (_, index) => ({
    id: `plan_${String(index).padStart(2, '0')}`,
    teamId: 'team_A',
    groupId: 'group_A',
    title: `Plan ${index}`,
    status: 'active',
    sourceGroupTrainingPlanId: null,
    macrocycles: [],
  }))
  const reader = createCoachPlanningListOperation({
    authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach' }),
    resolveActiveTeam: async () => ({ status: 'resolved' as const, teamId: 'team_A' }),
    authorize: async () => { count.authorize++; return { allowed: true } },
    listGroups: async () => { count.listGroups++; return [{ id: 'group_A', teamId: 'team_A' }] },
    listPlans: async (groupIds: string[]) => {
      count.listPlans++
      assert.deepEqual(groupIds, ['group_A'])
      return planItems
    },
    authorizePlan: async () => { count.authorizePlan++; return true },
    now: () => '2026-11-03T12:00:00.000Z',
  })
  const result = await reader.read()
  const summary = projectCoachHomePlanning(result, '2026-11-03')
  assert.equal(summary.status, 'ready')
  if (summary.status !== 'ready') throw new Error('expected ready')
  assert.equal(summary.planCount, 24)
  assert.equal(summary.plans.length, 12)
  assert.equal(count.listGroups, 1)
  assert.equal(count.listPlans, 1, 'The read operation must not make one list query per Plan')
  // Authorization per resource is deliberate H4A/H4B; do not replace it with UI filtering.
  assert.equal(count.authorizePlan, 24)
})

test('KAN-866/T3 does not read Plan collection for a denied capability', async () => {
  let loads = 0
  const reader = createCoachPlanningListOperation({
    authenticate: async () => ({ status: 'authenticated' as const, userId: 'coach' }),
    resolveActiveTeam: async () => ({ status: 'resolved' as const, teamId: 'team_A' }),
    authorize: async () => ({ allowed: false }),
    listGroups: async () => [{ id: 'group_A', teamId: 'team_A' }],
    listPlans: async () => { loads++; return [] },
    authorizePlan: async () => true,
    now: () => '2026-11-03T12:00:00.000Z',
  })
  assert.deepEqual(await reader.read(), { status: 'denied' })
  assert.equal(loads, 0)
})
