import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveAthletePlanningForDates } from '@/lib/planning-cohorts/planning-range-resolution'
import type {
  PlanningResolutionMembership,
  PlanningResolutionPlan,
} from '@/lib/planning-cohorts/planning-resolution'

function plan(overrides: Partial<PlanningResolutionPlan> = {}): PlanningResolutionPlan {
  return {
    id: 'base-plan',
    groupId: 'group-1',
    planningCohortId: null,
    status: 'active',
    isDeleted: false,
    macrocycles: [{
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      isDeleted: false,
    }],
    ...overrides,
  }
}

function membership(): PlanningResolutionMembership {
  return {
    id: 'membership-1',
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    isDeleted: false,
    cohort: {
      id: 'cohort-1',
      teamId: 'team-1',
      groupId: 'group-1',
      status: 'active',
      isDeleted: false,
      planningVariant: plan({
        id: 'variant-1',
        planningCohortId: 'cohort-1',
        macrocycles: [{
          startDate: '2026-09-10',
          endDate: '2026-09-20',
          isDeleted: false,
        }],
      }),
    },
  }
}

describe('planning range resolution', () => {
  it('resolves each unique date with cohort priority and group fallback', () => {
    const result = resolveAthletePlanningForDates({
      athleteTeamId: 'team-1',
      currentGroupId: 'group-1',
      groupChanges: [],
      memberships: [membership()],
      basePlans: [plan()],
    }, ['2026-09-21', '2026-09-12', '2026-09-12', '2026-09-09'])

    assert.deepEqual(result.map(item => item.date), [
      '2026-09-09',
      '2026-09-12',
      '2026-09-21',
    ])
    assert.equal(result[0].resolution.status === 'resolved' && result[0].resolution.source, 'group')
    assert.equal(result[1].resolution.status === 'resolved' && result[1].resolution.source, 'cohort')
    assert.equal(result[2].resolution.status === 'resolved' && result[2].resolution.source, 'group')
  })

  it('preserves none and conflict outcomes for individual dates', () => {
    const result = resolveAthletePlanningForDates({
      athleteTeamId: 'team-1',
      currentGroupId: 'group-1',
      groupChanges: [],
      memberships: [],
      basePlans: [plan(), plan({ id: 'base-plan-2' })],
    }, ['2026-09-05', '2026-10-05'])

    assert.equal(result[0].resolution.status, 'conflict')
    assert.equal(result[1].resolution.status, 'none')
  })
})
