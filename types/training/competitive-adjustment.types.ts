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

export type CourseTechnicality = 'unknown' | 'low' | 'moderate' | 'high' | 'very_high'
export type CourseProfileSource = 'manual' | 'gpx' | 'fit' | 'derived'

/**
 * Normalized course information consumed by demand assessment.
 *
 * H10 v1 only requires distance and can use D+ when known. Optional fields keep
 * the contract ready for future GPX/FIT enrichment without coupling domain
 * policy to track-file formats.
 */
export interface CourseProfile {
  /** Course distance in kilometers. */
  readonly distanceKm: number
  /** Positive elevation gain in meters; null when unknown. */
  readonly elevationGainM: number | null
  /** Negative elevation loss in meters; optional until richer course data is available. */
  readonly elevationLossM?: number | null
  readonly minAltitudeM?: number | null
  readonly maxAltitudeM?: number | null
  readonly technicality?: CourseTechnicality
  readonly source?: CourseProfileSource
}

export type CompetitionDemandBand =
  | 'unknown'
  | 'very_low'
  | 'low'
  | 'moderate'
  | 'high'
  | 'very_high'
  | 'extreme'

export type CompetitionDemandConfidence = 'low' | 'medium' | 'high'

/**
 * Course-demand assessment used by competitive-adjustment policy.
 *
 * `courseEffortKm` follows the distance + D+/100 baseline when D+ is known.
 * It characterizes the course and must not be interpreted as taper days or as a
 * generic training-load score.
 */
export interface CompetitionDemandAssessment {
  readonly courseEffortKm: number | null
  readonly band: CompetitionDemandBand
  readonly confidence: CompetitionDemandConfidence
  readonly profile: CourseProfile
  readonly limitations: {
    readonly elevationGainKnown: boolean
    readonly elevationLossKnown: boolean
    readonly altitudeProfileKnown: boolean
    readonly technicalityKnown: boolean
  }
}
