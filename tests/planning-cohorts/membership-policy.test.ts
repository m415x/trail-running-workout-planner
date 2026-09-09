import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  validateGroupChangeCohortImpact,
  validatePlanningCohortMembership,
  type ResolvedPlanningCohortMembershipPeriod,
} from '@/lib/planning-cohorts/membership-policy'
import type { AthleteProfile, PlanningCohort, PlanningCohortMembershipDraft } from '@/types'

const cohort: PlanningCohort = {
  id: 'cohort-1', teamId: 'team-1', groupId: 'group-m1', name: 'Objetivo 42K',
  purpose: 'Preparar la carrera principal de montaña', description: null, status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', isDeleted: false,
}

const athlete: AthleteProfile = {
  id: 'athlete-1', userId: 'user-1', teamId: 'team-1', groupId: 'group-m1', isActive: true,
  dni: '12345678',
}

function membership(overrides: Partial<PlanningCohortMembershipDraft> = {}): PlanningCohortMembershipDraft {
  return {
    planningCohortId: cohort.id, athleteProfileId: athlete.id, startDate: '2026-03-01', endDate: null,
    assignedByUserId: 'coach-1', assignmentReason: null, endedByUserId: null, endReason: null, ...overrides,
  }
}

function validate(overrides: Partial<Parameters<typeof validatePlanningCohortMembership>[0]> = {}) {
  return validatePlanningCohortMembership({
    membership: membership(), cohort, athlete, parentGroupIsActive: true, existingMemberships: [], ...overrides,
  })
}

function existing(overrides: Partial<ResolvedPlanningCohortMembershipPeriod> = {}): ResolvedPlanningCohortMembershipPeriod {
  return {
    id: 'membership-existing', planningCohortId: 'cohort-other', athleteProfileId: athlete.id,
    parentGroupId: cohort.groupId, startDate: '2026-02-01', endDate: '2026-02-28', ...overrides,
  }
}

describe('política de membresías de cohortes', () => {
  it('acepta una membresía abierta válida', () => {
    assert.deepEqual(validate(), { isValid: true, errors: [] })
  })

  it('exige identidades, equipo y grupo compatibles', () => {
    const result = validate({
      membership: membership({ planningCohortId: 'cohort-wrong', athleteProfileId: 'athlete-wrong' }),
      athlete: { ...athlete, teamId: 'team-other', groupId: 'group-s2' },
    })
    assert.deepEqual(result.errors.map((error) => error.code), [
      'cohort-identity-mismatch', 'athlete-identity-mismatch', 'team-mismatch', 'sporting-group-mismatch',
    ])
  })

  it('rechaza atletas, grupos o cohortes inactivos', () => {
    const result = validate({
      athlete: { ...athlete, isActive: false }, cohort: { ...cohort, status: 'archived' }, parentGroupIsActive: false,
    })
    assert.deepEqual(result.errors.map((error) => error.code), ['athlete-inactive', 'group-inactive', 'cohort-archived'])
  })

  it('valida formato y orden del intervalo inclusivo', () => {
    const malformed = validate({ membership: membership({ startDate: '01/03/2026' }) })
    const inverted = validate({ membership: membership({ startDate: '2026-03-02', endDate: '2026-03-01' }) })
    assert.ok(malformed.errors.some((error) => error.code === 'invalid-start-date'))
    assert.ok(inverted.errors.some((error) => error.code === 'end-before-start'))
  })

  it('no admite datos de cierre en una membresía abierta', () => {
    const result = validate({ membership: membership({ endedByUserId: 'coach-1', endReason: 'Cambio' }) })
    assert.ok(result.errors.some((error) => error.code === 'open-membership-with-end-metadata'))
  })

  it('rechaza solapamientos incluso cuando comparten un límite', () => {
    const result = validate({
      membership: membership({ startDate: '2026-03-01', endDate: '2026-04-01' }),
      existingMemberships: [existing({ endDate: '2026-03-01' })],
    })
    assert.ok(result.errors.some((error) => error.code === 'overlapping-membership'))
  })

  it('permite períodos consecutivos y excluir el registro editado', () => {
    assert.equal(validate({ existingMemberships: [existing()] }).isValid, true)
    const current = existing({ id: 'current', startDate: '2026-03-01', endDate: null })
    assert.equal(validate({
      membership: membership({ endDate: '2026-03-31' }), existingMemberships: [current], excludeMembershipId: current.id,
    }).isValid, true)
  })
})

describe('impacto de un cambio de grupo', () => {
  it('exige cerrar la cohorte anterior antes de la fecha efectiva', () => {
    const result = validateGroupChangeCohortImpact({
      athleteProfileId: athlete.id, currentGroupId: cohort.groupId, newGroupId: 'group-m2',
      effectiveDate: '2026-04-01', membershipsAfterChange: [existing({ startDate: '2026-03-01', endDate: '2026-04-01' })],
    })
    assert.equal(result.errors[0]?.code, 'membership-active-on-group-change')
  })

  it('acepta cierre previo o ausencia de cambio real', () => {
    assert.equal(validateGroupChangeCohortImpact({
      athleteProfileId: athlete.id, currentGroupId: cohort.groupId, newGroupId: 'group-m2',
      effectiveDate: '2026-04-01', membershipsAfterChange: [existing({ startDate: '2026-03-01', endDate: '2026-03-31' })],
    }).isValid, true)
    assert.equal(validateGroupChangeCohortImpact({
      athleteProfileId: athlete.id, currentGroupId: cohort.groupId, newGroupId: cohort.groupId,
      effectiveDate: '2026-04-01', membershipsAfterChange: [existing({ startDate: '2026-03-01', endDate: null })],
    }).isValid, true)
  })
})
