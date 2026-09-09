import { isValid, parseISO } from 'date-fns'

type PlanStatus = 'draft' | 'active' | 'completed' | 'cancelled'

export interface PlanningResolutionMacrocycle {
  startDate: string
  endDate: string
  isDeleted: boolean
}

export interface PlanningResolutionPlan {
  id: string
  groupId: string
  planningCohortId: string | null
  status: PlanStatus
  isDeleted: boolean
  macrocycles: PlanningResolutionMacrocycle[]
}

export interface PlanningResolutionMembership {
  id: string
  startDate: string
  endDate: string | null
  isDeleted: boolean
  cohort: {
    id: string
    teamId: string
    groupId: string
    status: 'active' | 'archived'
    isDeleted: boolean
    planningVariant: PlanningResolutionPlan | null
  }
}

export interface PlanningResolutionGroupChange {
  id: string
  date: string
  previousGroupId: string | null
  newGroupId: string
  isDeleted: boolean
}

export type AthletePlanningResolution =
  | { status: 'resolved'; source: 'cohort' | 'group'; groupId: string; planId: string; cohortId: string | null }
  | { status: 'none'; reason: 'no-group' | 'no-applicable-plan'; groupId: string | null }
  | { status: 'conflict'; reason: 'group-history' | 'overlapping-cohorts' | 'invalid-cohort-membership' | 'multiple-base-plans'; groupId: string | null; conflictingIds: string[] }

function isIsoCalendarDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

/** Resolves the athlete's sporting group on a date from current state and dated changes. */
export function resolveAthleteGroupOnDate(
  currentGroupId: string | null,
  groupChanges: PlanningResolutionGroupChange[],
  date: string,
): { groupId: string | null; conflictingIds: string[] } {
  if (!isIsoCalendarDate(date)) throw new RangeError('La fecha de resolución debe usar el formato YYYY-MM-DD.')

  const visibleChanges = groupChanges.filter((change) => !change.isDeleted)
  const duplicatedDate = visibleChanges.find((change, index) => (
    visibleChanges.findIndex((candidate) => candidate.date === change.date) !== index
  ))

  if (duplicatedDate) {
    return {
      groupId: null,
      conflictingIds: visibleChanges.filter((change) => change.date === duplicatedDate.date).map((change) => change.id),
    }
  }

  const firstChangeAfterDate = visibleChanges
    .filter((change) => change.date > date)
    .sort((first, second) => first.date.localeCompare(second.date))[0]

  return { groupId: firstChangeAfterDate?.previousGroupId ?? currentGroupId, conflictingIds: [] }
}

function planAppliesOn(plan: PlanningResolutionPlan, date: string) {
  return !plan.isDeleted
    && (plan.status === 'active' || plan.status === 'completed')
    && plan.macrocycles.some((macrocycle) => (
      !macrocycle.isDeleted && macrocycle.startDate <= date && macrocycle.endDate >= date
    ))
}

/**
 * Resolves the shared plan applicable to an athlete on one calendar date.
 *
 * A dated cohort variant takes precedence over the sporting-group base plan.
 * Invalid legacy overlaps are returned as conflicts instead of being selected
 * silently. This operation never creates an individual override.
 */
export function resolveAthletePlanningOnDate(input: {
  athleteTeamId: string
  currentGroupId: string | null
  groupChanges: PlanningResolutionGroupChange[]
  memberships: PlanningResolutionMembership[]
  basePlans: PlanningResolutionPlan[]
  date: string
}): AthletePlanningResolution {
  const groupResolution = resolveAthleteGroupOnDate(input.currentGroupId, input.groupChanges, input.date)

  if (groupResolution.conflictingIds.length > 0) {
    return { status: 'conflict', reason: 'group-history', groupId: null, conflictingIds: groupResolution.conflictingIds }
  }

  const groupId = groupResolution.groupId
  if (groupId === null) return { status: 'none', reason: 'no-group', groupId: null }

  const applicableMemberships = input.memberships.filter((membership) => (
    !membership.isDeleted
    && membership.startDate <= input.date
    && (membership.endDate === null || membership.endDate >= input.date)
  ))

  if (applicableMemberships.length > 1) {
    return { status: 'conflict', reason: 'overlapping-cohorts', groupId, conflictingIds: applicableMemberships.map((membership) => membership.id) }
  }

  const membership = applicableMemberships[0]
  if (membership) {
    const { cohort } = membership
    if (cohort.isDeleted || cohort.teamId !== input.athleteTeamId || cohort.groupId !== groupId) {
      return { status: 'conflict', reason: 'invalid-cohort-membership', groupId, conflictingIds: [membership.id] }
    }

    const variant = cohort.planningVariant
    if (variant && (
      variant.groupId !== groupId
      || variant.planningCohortId !== cohort.id
    )) {
      return { status: 'conflict', reason: 'invalid-cohort-membership', groupId, conflictingIds: [membership.id] }
    }

    if (variant && planAppliesOn(variant, input.date)) {
      return { status: 'resolved', source: 'cohort', groupId, planId: variant.id, cohortId: cohort.id }
    }
  }

  const applicableBasePlans = input.basePlans.filter((plan) => (
    plan.groupId === groupId
    && plan.planningCohortId === null
    && planAppliesOn(plan, input.date)
  ))

  if (applicableBasePlans.length > 1) {
    return { status: 'conflict', reason: 'multiple-base-plans', groupId, conflictingIds: applicableBasePlans.map((plan) => plan.id) }
  }

  const basePlan = applicableBasePlans[0]
  if (!basePlan) return { status: 'none', reason: 'no-applicable-plan', groupId }

  return { status: 'resolved', source: 'group', groupId, planId: basePlan.id, cohortId: null }
}
