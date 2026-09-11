import type { CompetitionPriority } from '@/types/training/competition-entry.types'

export type CompetitionAdjustmentStrategy =
  | 'full_taper'
  | 'proportional_adjustment'
  | 'specific_stimulus'

export type PostCompetitionPlanningProtection =
  | 'protected'
  | 'contextual'
  | 'minimal_interference'

export interface NumericRange {
  readonly min: number
  readonly max: number
}

/**
 * Priority-level guardrails for competitive adjustment.
 *
 * These values constrain later demand/load-aware decisions; they do not decide
 * the final taper duration, reduction curve, or physiological recovery need by
 * themselves.
 */
export interface CompetitionPriorityAdjustmentPolicy {
  readonly priority: CompetitionPriority
  readonly defaultStrategy: CompetitionAdjustmentStrategy
  /** Allowed formal taper duration in calendar days. */
  readonly taperDurationDays: NumericRange
  /** Allowed overall training-volume reduction relative to pre-competition reference load. */
  readonly volumeReductionPercentage: NumericRange
  /** Whether a demand/load-aware decision may choose no formal taper. */
  readonly allowNoFormalTaper: boolean
  /** Whether the event may be treated as a planned quality/specific stimulus. */
  readonly allowCompetitionAsTrainingStimulus: boolean
  /** Brief intensity stimuli should remain available while volume is reduced. */
  readonly preserveBriefIntensityStimuli: boolean
  /**
   * Planning protection around the post-competition phase.
   *
   * This does not determine physiological recovery duration. Recovery demand is
   * assessed separately from competition priority.
   */
  readonly postCompetitionPlanningProtection: PostCompetitionPlanningProtection
}
