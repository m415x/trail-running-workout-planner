import type { TrainingGoalType } from '@/types/athlete/athlete.types'
import type { BaseEntity } from '@/types/core/base.types'
import type { TargetValueSource } from '@/types/training/periodization.types'

export type IntensityZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export type IntensityMethod = 'hr_zone' | 'pam_percentage'

/**
 * Percentage of the athlete's maximal aerobic pace (PAM).
 *
 * Values use the human-readable scale: `90` means 90%, never the decimal
 * factor `0.9`. Athlete-specific pace conversion belongs to the physiology
 * layer and is not stored in group planning.
 */
export type PamPercentage = number

/** Concrete intensity prescribed for a training session. */
export type TrainingIntensity =
  | {
      method: 'hr_zone'
      zone: IntensityZone
    }
  | {
      method: 'pam_percentage'
      pamPercentage: PamPercentage
    }

/** Inputs retained as the planning criterion for an intensity strategy. */
export interface IntensityStrategyContext {
  goalType: TrainingGoalType
}

/**
 * Configurable constraints used to generate weekly intensity targets.
 *
 * Recovery is expressed as complete calendar days between intense sessions.
 * These values constrain future session generation but do not assign dates.
 */
export interface IntensityStrategyValues {
  defaultMethod: IntensityMethod
  maximumIntenseSessionsPerWeek: number
  minimumRecoveryDaysBetweenIntenseSessions: number
}

export type IntensityStrategyField = keyof IntensityStrategyValues
export type IntensityStrategyValueSource = 'suggested' | 'manual'

/** Tracks whether each strategy constraint was suggested or set by the coach. */
export type IntensityStrategyFieldSources = {
  [Field in IntensityStrategyField]: IntensityStrategyValueSource
}

/** Strategy before it is associated with a persisted group training plan. */
export interface IntensityStrategyDraft {
  context: IntensityStrategyContext
  values: IntensityStrategyValues
  fieldSources: IntensityStrategyFieldSources
}

/** Persisted domain representation. Its database mapping is introduced later. */
export interface IntensityStrategy extends BaseEntity, IntensityStrategyDraft {
  groupTrainingPlanId: string
}

/**
 * Weekly intensity intent resolved for one microcycle.
 *
 * `predominantZone` describes the overall weekly emphasis while an optional
 * PAM target describes the intensive stimulus. This allows a week to be
 * predominantly Z2 and still prescribe one session at 90% PAM.
 */
export interface MicrocycleIntensityTargetDraft {
  intenseSessionsTarget: number
  predominantZone: IntensityZone
  pamPercentageTarget: PamPercentage | null
  minimumRecoveryDaysBetweenIntenseSessions: number
  source: TargetValueSource
}

/** Weekly intensity target associated with a persisted microcycle. */
export interface MicrocycleIntensityTarget
  extends BaseEntity,
    MicrocycleIntensityTargetDraft {
  microcycleId: string
}
