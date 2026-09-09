import type { PlanningCohortMembership } from '@/types'

type MembershipPeriod = Pick<
  PlanningCohortMembership,
  'startDate' | 'endDate' | 'isDeleted'
>

export type PlanningCohortMembershipTiming = 'current' | 'scheduled' | 'historical'

/**
 * Determines whether a persisted cohort membership applies on an ISO calendar date.
 *
 * Both interval boundaries are inclusive. Soft-deleted records never apply.
 */
export function isPlanningCohortMembershipActiveOn(
  membership: MembershipPeriod,
  date: string,
) {
  return !membership.isDeleted
    && membership.startDate <= date
    && (membership.endDate === null || membership.endDate >= date)
}

/** Classifies a visible membership relative to one ISO calendar date. */
export function classifyPlanningCohortMembership(
  membership: MembershipPeriod,
  date: string,
): PlanningCohortMembershipTiming | null {
  if (membership.isDeleted) return null
  if (membership.startDate > date) return 'scheduled'
  if (membership.endDate !== null && membership.endDate < date) return 'historical'

  return 'current'
}
