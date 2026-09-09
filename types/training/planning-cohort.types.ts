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

