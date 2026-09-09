import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  resolveAthleteGroupOnDate,
  resolveAthletePlanningOnDate,
  type PlanningResolutionMembership,
  type PlanningResolutionPlan,
} from '@/lib/planning-cohorts/planning-resolution'

function plan(overrides: Partial<PlanningResolutionPlan> = {}): PlanningResolutionPlan {
  return {
    id: 'base-plan', groupId: 'group-s2', planningCohortId: null, status: 'active', isDeleted: false,
    macrocycles: [{ startDate: '2026-01-01', endDate: '2026-12-31', isDeleted: false }],
    ...overrides,
  }
}

function membership(overrides: Partial<PlanningResolutionMembership> = {}): PlanningResolutionMembership {
  return {
    id: 'membership-1', startDate: '2026-03-01', endDate: null, isDeleted: false,
    cohort: {
      id: 'cohort-1', teamId: 'team-1', groupId: 'group-s2', status: 'active', isDeleted: false,
      planningVariant: plan({ id: 'variant-1', planningCohortId: 'cohort-1' }),
    },
    ...overrides,
  }
}

const baseInput = {
  athleteTeamId: 'team-1', currentGroupId: 'group-s2', groupChanges: [],
  memberships: [membership()], basePlans: [plan()], date: '2026-06-01',
}

describe('resolución fechada de planificación', () => {
  it('prioriza la variante de una cohorte aplicable', () => {
    assert.deepEqual(resolveAthletePlanningOnDate(baseInput), {
      status: 'resolved', source: 'cohort', groupId: 'group-s2', planId: 'variant-1', cohortId: 'cohort-1',
    })
  })

  it('usa el plan grupal si la cohorte no tiene una variante aplicable', () => {
    const withoutVariant = membership()
    withoutVariant.cohort.planningVariant = null
    const withoutVariantResult = resolveAthletePlanningOnDate({ ...baseInput, memberships: [withoutVariant] })
    const withoutMembershipResult = resolveAthletePlanningOnDate({ ...baseInput, memberships: [] })
    assert.equal(withoutVariantResult.status === 'resolved' && withoutVariantResult.source, 'group')
    assert.equal(withoutMembershipResult.status === 'resolved' && withoutMembershipResult.source, 'group')
  })

  it('respeta la fecha de macrociclo y el estado publicable del plan', () => {
    const result = resolveAthletePlanningOnDate({
      ...baseInput,
      memberships: [],
      basePlans: [plan({ status: 'draft' })],
    })
    assert.deepEqual(result, { status: 'none', reason: 'no-applicable-plan', groupId: 'group-s2' })
  })

  it('devuelve conflicto ante cohortes solapadas o asociaciones inválidas', () => {
    const overlap = resolveAthletePlanningOnDate({ ...baseInput, memberships: [membership(), membership({ id: 'membership-2' })] })
    assert.equal(overlap.status, 'conflict')
    assert.equal(overlap.status === 'conflict' && overlap.reason, 'overlapping-cohorts')

    const invalid = membership()
    invalid.cohort.groupId = 'group-m1'
    assert.equal(resolveAthletePlanningOnDate({ ...baseInput, memberships: [invalid] }).status, 'conflict')
  })

  it('devuelve conflicto si dos planes base cubren la misma fecha', () => {
    const result = resolveAthletePlanningOnDate({ ...baseInput, memberships: [], basePlans: [plan(), plan({ id: 'base-plan-2' })] })
    assert.equal(result.status, 'conflict')
    assert.equal(result.status === 'conflict' && result.reason, 'multiple-base-plans')
  })

  it('reconstruye el grupo histórico desde los cambios posteriores', () => {
    const changes = [
      { id: 'change-1', date: '2026-03-01', previousGroupId: 'group-s1', newGroupId: 'group-s2', isDeleted: false },
      { id: 'change-2', date: '2026-07-01', previousGroupId: 'group-s2', newGroupId: 'group-m1', isDeleted: false },
    ]
    assert.equal(resolveAthleteGroupOnDate('group-m1', changes, '2026-02-01').groupId, 'group-s1')
    assert.equal(resolveAthleteGroupOnDate('group-m1', changes, '2026-05-01').groupId, 'group-s2')
    assert.equal(resolveAthleteGroupOnDate('group-m1', changes, '2026-08-01').groupId, 'group-m1')
  })

  it('no selecciona silenciosamente un historial de grupo ambiguo', () => {
    const result = resolveAthleteGroupOnDate('group-m1', [
      { id: 'change-1', date: '2026-03-01', previousGroupId: 'group-s1', newGroupId: 'group-s2', isDeleted: false },
      { id: 'change-2', date: '2026-03-01', previousGroupId: 'group-s1', newGroupId: 'group-m1', isDeleted: false },
    ], '2026-02-01')
    assert.deepEqual(result.conflictingIds, ['change-1', 'change-2'])
  })
})
