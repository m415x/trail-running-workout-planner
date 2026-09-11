import type { CompetitionPriority } from '@/types/training/competition-entry.types'
import type {
  IntensityEmphasis,
  IntensityZone,
  PamPercentage,
} from '@/types/training/intensity.types'

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

/** Normalized course information consumed by demand assessment. */
export interface CourseProfile {
  readonly distanceKm: number
  readonly elevationGainM: number | null
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

export type PreCompetitionLoadTrend = 'rising' | 'stable' | 'falling'

export interface PreCompetitionWeekLoad {
  readonly volumeKm: number
  readonly elevationGainM: number | null
}

export interface PreCompetitionLoadContext {
  readonly referenceWindowWeeks: number
  readonly analyzedWeeks: number
  readonly volume: {
    readonly recentAverageKm: number
    readonly achievedPeakVolumeKm: number
    readonly trend: PreCompetitionLoadTrend
  }
  readonly elevation: {
    readonly recentAverageGainM: number | null
    readonly achievedPeakElevationGainM: number | null
    readonly trend: PreCompetitionLoadTrend | null
    readonly knownWeeks: number
  }
}

export type TaperDecisionReasonCode =
  | 'priority_guardrail'
  | 'course_demand'
  | 'course_demand_unknown'
  | 'reached_load'
  | 'elevation_load_available'
  | 'elevation_load_unknown'

export interface TaperDurationDecision {
  readonly priority: CompetitionPriority
  readonly strategy: CompetitionAdjustmentStrategy
  readonly durationDays: number
  readonly policyLimitsDays: NumericRange
  readonly demandPositionRange: NumericRange
  readonly reachedLoadPosition: number
  readonly requiresCoachReview: boolean
  readonly rationale: {
    readonly demandBand: CompetitionDemandBand
    readonly demandConfidence: CompetitionDemandConfidence
    readonly volumeTrend: PreCompetitionLoadTrend
    readonly elevationTrend: PreCompetitionLoadTrend | null
    readonly volumeSustainedLoadRatio: number
    readonly elevationSustainedLoadRatio: number | null
    readonly reasonCodes: readonly TaperDecisionReasonCode[]
  }
}

export interface TaperVolumeCurvePoint {
  readonly dayNumber: number
  readonly daysBeforeCompetition: number
  readonly reductionPercentage: number
  readonly remainingVolumePercentage: number
  readonly targetWeeklyEquivalentVolumeKm: number
}

export interface TaperVolumeReductionCurve {
  readonly priority: CompetitionPriority
  readonly durationDays: number
  readonly referenceVolumeKm: number
  readonly finalReductionPercentage: number
  readonly points: readonly TaperVolumeCurvePoint[]
}

export type TaperElevationSpecificity =
  | 'unknown'
  | 'flat_or_minimal'
  | 'meaningful_vertical'
  | 'high_vertical'

/** One calendar-day point in the D+ taper curve, expressed as a weekly-equivalent target. */
export interface TaperElevationCurvePoint {
  readonly dayNumber: number
  readonly daysBeforeCompetition: number
  readonly reductionPercentage: number
  readonly remainingElevationPercentage: number
  readonly targetWeeklyEquivalentElevationGainM: number
}

/**
 * Progressive D+ reduction kept independent from volume reduction.
 *
 * The curve unloads vertical work while retaining a bounded amount of specific
 * climbing exposure when the target course has meaningful D+.
 */
export interface TaperElevationReductionCurve {
  readonly priority: CompetitionPriority
  readonly durationDays: number
  readonly referenceElevationGainM: number | null
  readonly courseVerticalDensityMPerKm: number | null
  readonly specificity: TaperElevationSpecificity
  readonly finalReductionPercentage: number | null
  readonly specificityFloorPercentage: number | null
  readonly requiresCoachReview: boolean
  readonly points: readonly TaperElevationCurvePoint[]
}

/** Existing weekly intensity target projected into H10 without redefining intensity semantics. */
export interface TaperIntensityReference {
  readonly emphasis: IntensityEmphasis
  readonly intenseSessionsTarget: number
  readonly predominantZone: IntensityZone
  readonly pamPercentageTarget: PamPercentage | null
  readonly minimumRecoveryDaysBetweenIntenseSessions: number
}

export type TaperIntensityReasonCode =
  | 'no_formal_taper'
  | 'brief_intensity_preserved'
  | 'intense_session_count_reduced'
  | 'existing_hr_zone_preserved'
  | 'existing_pam_percentage_preserved'

/**
 * H10 proposal for retaining short quality stimuli while unloading total work.
 *
 * It deliberately reuses the existing HR-zone/PAM target model. Intensity
 * magnitude is not multiplied by the taper volume curve; later session
 * reconciliation reduces duration/repetitions/total work instead.
 */
export interface TaperIntensityPreservationDecision {
  readonly priority: CompetitionPriority
  readonly durationDays: number
  readonly preserveBriefIntensityStimuli: boolean
  readonly reference: TaperIntensityReference
  readonly proposed: TaperIntensityReference
  readonly requiresCoachReview: boolean
  readonly reasonCodes: readonly TaperIntensityReasonCode[]
}

/** Prescribed training load in the calendar week containing a competition. */
export interface CompetitionWeekTrainingLoad {
  readonly volumeKm: number
  readonly elevationGainM: number | null
}

/** Competition exposure kept separate from the prescribed training target. */
export interface CompetitionWeekCompetitionLoad {
  readonly competitionId: string
  readonly name: string
  readonly date: string
  readonly priority: CompetitionPriority
  readonly distanceKm: number
  readonly elevationGainM: number | null
}

/**
 * Race-week load boundary.
 *
 * `training` is the coach/system prescription before/around the race and never
 * includes race distance or race D+. `competition` is the event exposure. The
 * optional totals are derived views only and must not be persisted back as
 * training targets.
 */
export interface CompetitionWeekLoad {
  readonly training: CompetitionWeekTrainingLoad
  readonly competition: CompetitionWeekCompetitionLoad
  readonly totalExposure: {
    readonly distanceKm: number
    readonly elevationGainM: number | null
  }
}
