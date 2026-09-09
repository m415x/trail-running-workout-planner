import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { validatePlanningCohortMembership } from '@/lib/planning-cohorts/membership-policy'
import {
  resolveAthletePlanningOnDate,
  type PlanningResolutionMembership,
  type PlanningResolutionPlan,
} from '@/lib/planning-cohorts/planning-resolution'

const date = '2026-09-15'

function plan(overrides: Partial<PlanningResolutionPlan> = {}): PlanningResolutionPlan {
  return {
    id: 'plan-s2',
    groupId: 'group-s2',
    planningCohortId: null,
    status: 'active',
    isDeleted: false,
    macrocycles: [{ startDate: '2026-09-01', endDate: '2026-12-31', isDeleted: false }],
    ...overrides,
  }
}

function membership(overrides: Partial<PlanningResolutionMembership> = {}): PlanningResolutionMembership {
  return {
    id: 'membership-athlete-s2',
    startDate: '2026-09-01',
    endDate: null,
    isDeleted: false,
    cohort: {
      id: 'cohort-s2',
      teamId: 'team-1',
      groupId: 'group-s2',
      status: 'active',
      isDeleted: false,
      planningVariant: plan({ id: 'variant-s2', planningCohortId: 'cohort-s2' }),
    },
    ...overrides,
  }
}

describe('aislamiento de cohortes de planificación', () => {
  it('rechaza una asignación entre equipos aunque grupo y atleta parezcan compatibles', () => {
    const validation = validatePlanningCohortMembership({
      membership: {
        planningCohortId: 'cohort-s2', athleteProfileId: 'athlete-s2', startDate: date,
        endDate: null, assignedByUserId: null, assignmentReason: null, endedByUserId: null, endReason: null,
      },
      cohort: { id: 'cohort-s2', teamId: 'team-2', groupId: 'group-s2', status: 'active' },
      athlete: { id: 'athlete-s2', teamId: 'team-1', groupId: 'group-s2', isActive: true },
      parentGroupIsActive: true,
      existingMemberships: [],
    })

    assert.ok(validation.errors.some((error) => error.code === 'team-mismatch'))
  })

  it('rechaza una asignación a una cohorte de otro grupo', () => {
    const validation = validatePlanningCohortMembership({
      membership: {
        planningCohortId: 'cohort-m1', athleteProfileId: 'athlete-s2', startDate: date,
        endDate: null, assignedByUserId: null, assignmentReason: null, endedByUserId: null, endReason: null,
      },
      cohort: { id: 'cohort-m1', teamId: 'team-1', groupId: 'group-m1', status: 'active' },
      athlete: { id: 'athlete-s2', teamId: 'team-1', groupId: 'group-s2', isActive: true },
      parentGroupIsActive: true,
      existingMemberships: [],
    })

    assert.ok(validation.errors.some((error) => error.code === 'sporting-group-mismatch'))
  })

  it('no aplica una cohorte perteneciente a otro equipo o grupo', () => {
    const otherTeam = membership()
    otherTeam.cohort.teamId = 'team-2'
    const otherGroup = membership()
    otherGroup.cohort.groupId = 'group-m1'

    for (const isolatedMembership of [otherTeam, otherGroup]) {
      const result = resolveAthletePlanningOnDate({
        athleteTeamId: 'team-1', currentGroupId: 'group-s2', groupChanges: [],
        memberships: [isolatedMembership], basePlans: [plan()], date,
      })
      assert.equal(result.status, 'conflict')
      assert.equal(result.status === 'conflict' && result.reason, 'invalid-cohort-membership')
    }
  })

  it('ignora planes base de otros grupos y no los usa como fallback', () => {
    const result = resolveAthletePlanningOnDate({
      athleteTeamId: 'team-1', currentGroupId: 'group-s2', groupChanges: [], memberships: [],
      basePlans: [plan({ id: 'plan-m1', groupId: 'group-m1' })], date,
    })

    assert.deepEqual(result, { status: 'none', reason: 'no-applicable-plan', groupId: 'group-s2' })
  })

  it('ignora membresías y planes eliminados sin afectar el fallback válido', () => {
    const result = resolveAthletePlanningOnDate({
      athleteTeamId: 'team-1', currentGroupId: 'group-s2', groupChanges: [],
      memberships: [membership({ isDeleted: true })],
      basePlans: [plan({ id: 'deleted-plan', isDeleted: true }), plan()],
      date,
    })

    assert.deepEqual(result, {
      status: 'resolved', source: 'group', groupId: 'group-s2', planId: 'plan-s2', cohortId: null,
    })
  })

  it('no deja que un solapamiento seleccione arbitrariamente otra cohorte', () => {
    const second = membership({ id: 'membership-athlete-s2-second' })
    second.cohort = {
      ...second.cohort,
      id: 'cohort-s2-second',
      planningVariant: plan({ id: 'variant-s2-second', planningCohortId: 'cohort-s2-second' }),
    }
    const result = resolveAthletePlanningOnDate({
      athleteTeamId: 'team-1', currentGroupId: 'group-s2', groupChanges: [],
      memberships: [membership(), second], basePlans: [plan()], date,
    })

    assert.equal(result.status, 'conflict')
    assert.deepEqual(result.status === 'conflict' && result.conflictingIds.sort(), [
      'membership-athlete-s2',
      'membership-athlete-s2-second',
    ])
  })
})
