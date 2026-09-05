import type { TrainingGoalType } from '@/types/athlete/athlete.types'
import type { AthleteGroupCode } from '@/types/athlete/group.types'
import type { BaseEntity } from '@/types/core/base.types'
import type {
  MicrocycleType,
  PeriodType,
  TargetValueSource,
} from '@/types/training/periodization.types'

export type IntensityZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

export type IntensityMethod = 'hr_zone' | 'pam_percentage'

export type IntensitySessionDemand = 'none' | 'reduced' | 'standard' | 'high'

export type IntensityEmphasis =
  | 'recovery'
  | 'aerobic'
  | 'tempo'
  | 'threshold'
  | 'vo2max'
  | 'race_specific'

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
  athleteGroup: AthleteGroupCode
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

export type IntensityStrategyLimits = Pick<
  IntensityStrategyValues,
  'maximumIntenseSessionsPerWeek' | 'minimumRecoveryDaysBetweenIntenseSessions'
>

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

/**
 * Qualitative recommendation for a period, microcycle and group objective.
 *
 * The rule deliberately does not contain a final number of intense sessions:
 * later calculation must resolve `intenseSessionDemand` against the strategy
 * limits and the number of weekly sessions available.
 */
export interface IntensityStrategyRule {
  emphasis: IntensityEmphasis
  predominantZone: IntensityZone
  intenseSessionDemand: IntensitySessionDemand
  suggestedPamPercentage: PamPercentage | null
}

/** Exhaustive intensity rule matrix indexed by period, microcycle and goal. */
export type IntensityStrategyMatrix = Record<
  PeriodType,
  Record<MicrocycleType, Record<TrainingGoalType, IntensityStrategyRule>>
>
