import type { PlanningCohortMembership } from '@/types'

type MembershipPeriod = Pick<
  PlanningCohortMembership,
  'startDate' | 'endDate' | 'isDeleted'
>

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
