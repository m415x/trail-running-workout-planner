import type { BaseEntity } from '@/types/core/base.types'

/** Lifecycle of a shared planning cohort. */
export type PlanningCohortStatus = 'active' | 'archived'

/**
 * Coach-defined subdivision of one sporting group before persistence.
 *
 * A cohort belongs to exactly one team and one parent AthleteGroup. It groups
 * athletes who share a planning variant, but it does not change their sporting
 * category, level, current group, or individual TrainingGoal.
 *
 * The cohort deliberately has no date range. Athlete participation is dated by
 * PlanningCohortMembership, while planning horizons belong to the associated
 * GroupTrainingPlan and its macrocycles.
 */
export interface PlanningCohortDraft {
  teamId: string
  groupId: string
  name: string
  purpose: string
  description: string | null
}

/**
 * Persisted shared planning cohort.
 *
 * Archived cohorts remain available for historical planning resolution and
 * audit, but cannot receive new memberships or planning variants.
 */
export interface PlanningCohort extends BaseEntity, PlanningCohortDraft {
  status: PlanningCohortStatus
}

/**
 * Dated athlete assignment to a shared planning cohort before persistence.
 *
 * Dates use the ISO `YYYY-MM-DD` calendar format and both boundaries are
 * inclusive. A null endDate represents an open membership. The referenced
 * athlete is an AthleteProfile, not an application User or a fee membership.
 */
export interface PlanningCohortMembershipDraft {
  planningCohortId: string
  athleteProfileId: string
  startDate: string
  endDate: string | null
  assignedByUserId: string | null
  assignmentReason: string | null
  endedByUserId: string | null
  endReason: string | null
}

/**
 * Persisted historical membership between an athlete and a planning cohort.
 *
 * Closing a membership updates its end metadata; later assignments create new
 * records instead of reopening or rewriting the historical period.
 */
export interface PlanningCohortMembership
  extends BaseEntity, PlanningCohortMembershipDraft {}
