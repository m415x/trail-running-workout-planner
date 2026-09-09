import { isValid, parseISO } from 'date-fns'

import type { AthleteProfile, PlanningCohort, PlanningCohortMembershipDraft } from '@/types'

export type PlanningCohortMembershipIssueField =
  | 'planningCohortId'
  | 'athleteProfileId'
  | 'startDate'
  | 'endDate'
  | 'membership'

export interface PlanningCohortMembershipIssue {
  field: PlanningCohortMembershipIssueField
  code: string
  message: string
}

export interface PlanningCohortMembershipValidationResult {
  isValid: boolean
  errors: PlanningCohortMembershipIssue[]
}

/** Existing membership enriched with the parent group needed for overlap rules. */
export interface ResolvedPlanningCohortMembershipPeriod {
  id: string
  planningCohortId: string
  athleteProfileId: string
  parentGroupId: string
  startDate: string
  endDate: string | null
}

export interface ValidatePlanningCohortMembershipInput {
  membership: PlanningCohortMembershipDraft
  cohort: Pick<PlanningCohort, 'id' | 'teamId' | 'groupId' | 'status'>
  athlete: Pick<AthleteProfile, 'id' | 'teamId' | 'groupId' | 'isActive'>
  parentGroupIsActive: boolean
  existingMemberships: ResolvedPlanningCohortMembershipPeriod[]
  /** Membership being edited or closed, if any. */
  excludeMembershipId?: string
}

export interface ValidateGroupChangeCohortImpactInput {
  athleteProfileId: string
  currentGroupId: string
  newGroupId: string
  effectiveDate: string
  membershipsAfterChange: ResolvedPlanningCohortMembershipPeriod[]
}

export interface ValidatePlanningCohortMembershipClosureInput {
  membership: Pick<PlanningCohortMembershipDraft, 'startDate' | 'endDate'>
  endDate: string
}

function isIsoCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

function periodsOverlap(firstStart: string, firstEnd: string | null, secondStart: string, secondEnd: string | null) {
  return firstStart <= (secondEnd ?? '9999-12-31')
    && secondStart <= (firstEnd ?? '9999-12-31')
}

function issue(
  field: PlanningCohortMembershipIssueField,
  code: string,
  message: string,
): PlanningCohortMembershipIssue {
  return { field, code, message }
}

/**
 * Validates one dated cohort assignment without accessing persistence.
 *
 * Date boundaries are inclusive. Therefore, a membership ending on the same
 * day another begins still overlaps; the previous period must end earlier.
 */
export function validatePlanningCohortMembership(
  input: ValidatePlanningCohortMembershipInput,
): PlanningCohortMembershipValidationResult {
  const { athlete, cohort, membership } = input
  const errors: PlanningCohortMembershipIssue[] = []
  const validStartDate = isIsoCalendarDate(membership.startDate)
  const validEndDate = membership.endDate === null || isIsoCalendarDate(membership.endDate)

  if (membership.planningCohortId !== cohort.id) {
    errors.push(issue('planningCohortId', 'cohort-identity-mismatch', 'La membresía no corresponde a la cohorte indicada.'))
  }

  if (membership.athleteProfileId !== athlete.id) {
    errors.push(issue('athleteProfileId', 'athlete-identity-mismatch', 'La membresía no corresponde al perfil del atleta indicado.'))
  }

  if (cohort.teamId !== athlete.teamId) {
    errors.push(issue('membership', 'team-mismatch', 'El atleta y la cohorte deben pertenecer al mismo equipo.'))
  }

  if (athlete.groupId !== cohort.groupId) {
    errors.push(issue('membership', 'sporting-group-mismatch', 'El grupo actual del atleta no coincide con el grupo padre de la cohorte.'))
  }

  if (!athlete.isActive) {
    errors.push(issue('membership', 'athlete-inactive', 'No se puede asignar un atleta inactivo.'))
  }

  if (!input.parentGroupIsActive) {
    errors.push(issue('membership', 'group-inactive', 'No se puede asignar una cohorte de un grupo inactivo.'))
  }

  if (cohort.status !== 'active') {
    errors.push(issue('membership', 'cohort-archived', 'No se puede asignar una cohorte archivada.'))
  }

  if (!validStartDate) {
    errors.push(issue('startDate', 'invalid-start-date', 'La fecha de inicio debe usar el formato YYYY-MM-DD.'))
  }

  if (!validEndDate) {
    errors.push(issue('endDate', 'invalid-end-date', 'La fecha de fin debe usar el formato YYYY-MM-DD.'))
  }

  if (validStartDate && membership.endDate !== null && validEndDate && membership.endDate < membership.startDate) {
    errors.push(issue('endDate', 'end-before-start', 'La fecha de fin no puede ser anterior a la fecha de inicio.'))
  }

  if (membership.endDate === null && (membership.endedByUserId !== null || membership.endReason !== null)) {
    errors.push(issue('endDate', 'open-membership-with-end-metadata', 'Una membresía abierta no puede contener datos de finalización.'))
  }

  if (validStartDate && validEndDate) {
    const overlappingMembership = input.existingMemberships.find((existing) => (
      existing.id !== input.excludeMembershipId
      && existing.athleteProfileId === athlete.id
      && existing.parentGroupId === cohort.groupId
      && isIsoCalendarDate(existing.startDate)
      && (existing.endDate === null || isIsoCalendarDate(existing.endDate))
      && periodsOverlap(membership.startDate, membership.endDate, existing.startDate, existing.endDate)
    ))

    if (overlappingMembership) {
      errors.push(issue('membership', 'overlapping-membership', 'El atleta ya tiene una membresía de cohorte aplicable en ese período.'))
    }
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Ensures a sporting-group change does not leave an old cohort applicable.
 *
 * The caller must prepare all membership closures in the same transaction and
 * pass their resulting periods here. With inclusive dates, each previous-group
 * membership must end strictly before the group change becomes effective.
 */
export function validateGroupChangeCohortImpact(
  input: ValidateGroupChangeCohortImpactInput,
): PlanningCohortMembershipValidationResult {
  const errors: PlanningCohortMembershipIssue[] = []

  if (!isIsoCalendarDate(input.effectiveDate)) {
    errors.push(issue('endDate', 'invalid-group-change-date', 'La fecha efectiva del cambio de grupo debe usar el formato YYYY-MM-DD.'))
    return { isValid: false, errors }
  }

  if (input.currentGroupId === input.newGroupId) {
    return { isValid: true, errors }
  }

  const unresolvedMembership = input.membershipsAfterChange.find((membership) => (
    membership.athleteProfileId === input.athleteProfileId
    && membership.parentGroupId === input.currentGroupId
    && membership.startDate <= input.effectiveDate
    && (membership.endDate === null || membership.endDate >= input.effectiveDate)
  ))

  if (unresolvedMembership) {
    errors.push(issue('membership', 'membership-active-on-group-change', 'El cambio de grupo debe cerrar antes las membresías activas del grupo anterior.'))
  }

  return { isValid: errors.length === 0, errors }
}

/** Validates the inclusive final day used to close an open membership. */
export function validatePlanningCohortMembershipClosure(
  input: ValidatePlanningCohortMembershipClosureInput,
): PlanningCohortMembershipValidationResult {
  const errors: PlanningCohortMembershipIssue[] = []

  if (input.membership.endDate !== null) {
    errors.push(issue('membership', 'membership-already-closed', 'La membresía ya tiene una fecha de finalización.'))
  }

  if (!isIsoCalendarDate(input.endDate)) {
    errors.push(issue('endDate', 'invalid-end-date', 'La fecha de fin debe usar el formato YYYY-MM-DD.'))
  } else if (input.endDate < input.membership.startDate) {
    errors.push(issue('endDate', 'end-before-start', 'La fecha de fin no puede ser anterior a la fecha de inicio.'))
  }

  return { isValid: errors.length === 0, errors }
}
