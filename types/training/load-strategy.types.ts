import type { AthleteGroupCode } from '@/types/athlete/group.types'
import type { TrainingGoalType } from '@/types/athlete/athlete.types'
import type { BaseEntity } from '@/types/core/base.types'

/**
 * Inputs that were used to obtain the initial load recommendation.
 *
 * The goal type is kept as a snapshot of the planning criterion. It is not a
 * foreign key to an athlete's TrainingGoal because planning remains group-first.
 */
export interface LoadStrategyContext {
  athleteGroup: AthleteGroupCode
  goalType: TrainingGoalType
}

/**
 * Effective parameters that constrain load generation for a group plan.
 * Percentages use the human-readable 0-100 scale, not decimal factors.
 */
export interface LoadStrategyValues {
  initialWeeklyVolumeKm: number
  maximumWeeklyVolumeKm: number
  sessionsPerWeek: number
  maximumWeeklyIncreasePercentage: number
  deloadPercentage: number
  initialWeeklyElevationGain: number | null
  maximumWeeklyElevationGain: number | null
}

export type LoadStrategyField = keyof LoadStrategyValues
export type LoadStrategyValueSource = 'suggested' | 'manual'

/**
 * Tracks provenance per value so a strategy can combine suggested and manually
 * adjusted parameters without losing which decisions belong to the coach.
 */
export type LoadStrategyFieldSources = {
  [Field in LoadStrategyField]: LoadStrategyValueSource
}

/** Strategy before it is associated with a persisted group training plan. */
export interface LoadStrategyDraft {
  context: LoadStrategyContext
  values: LoadStrategyValues
  fieldSources: LoadStrategyFieldSources
}

/** Persisted domain representation. Database mapping is defined separately. */
export interface LoadStrategy extends BaseEntity, LoadStrategyDraft {
  groupTrainingPlanId: string
}
