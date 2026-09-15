import type { MicrocycleLoadFocus, MicrocycleType } from '@/types/training/periodization.types'

export const SYSTEMATIC_VOLUME_RULE_VERSION = 'systematic-volume-v1' as const

export type SystematicVolumeDimension = 'distanceKm' | 'durationMin' | 'elevationGainM'

export type SystematicVolumePattern =
  | 'within_plan'
  | 'isolated_excess'
  | 'systematic_excess'
  | 'insufficient_data'

export type SystematicVolumeAttention = 'none' | 'info' | 'review' | 'priority'

export type SystematicVolumeInsufficientReason =
  | 'missing_planned_value'
  | 'missing_realized_value'
  | 'incompatible_units'
  | 'insufficient_microcycle_coverage'
  | 'planning_resolution'

export type SystematicVolumeCompetitionPhase = 'pre' | 'race' | 'post'

export interface SystematicVolumeRuleConfig {
  readonly version: typeof SYSTEMATIC_VOLUME_RULE_VERSION
  readonly persistenceUnit: 'microcycle'
  /** Operational MVP heuristic, not a physiological threshold. */
  readonly consecutiveEvaluableMicrocycles: 2
  readonly dimensions: readonly SystematicVolumeDimension[]
  /** `priority` is reserved for future multi-signal triage composition. */
  readonly maximumStandaloneAttention: 'review'
}

export const SYSTEMATIC_VOLUME_RULE_CONFIG: SystematicVolumeRuleConfig = {
  version: SYSTEMATIC_VOLUME_RULE_VERSION,
  persistenceUnit: 'microcycle',
  consecutiveEvaluableMicrocycles: 2,
  dimensions: ['distanceKm', 'durationMin', 'elevationGainM'],
  maximumStandaloneAttention: 'review',
}

export interface SystematicVolumeMagnitude {
  readonly planned: number
  readonly realized: number
  readonly absoluteDelta: number
  readonly relativeDeltaPercent: number | null
}

export interface SystematicVolumeCoverage {
  readonly plannedSessions: number
  readonly comparableSessions: number
  readonly unknownSessions: number
  readonly unplannedRealizedSessions: number
  readonly coverageRatio: number | null
}

export interface SystematicVolumePlanningContext {
  readonly microcycleType: MicrocycleType
  readonly loadFocus: MicrocycleLoadFocus | null
  readonly competitionPhases: readonly SystematicVolumeCompetitionPhase[]
  readonly competitionIds: readonly string[]
  readonly requiresCoachReview: boolean
}

export interface SystematicVolumeMicrocycleEvidence {
  readonly microcycleId: string
  readonly startDate: string
  readonly endDate: string
  readonly dimension: SystematicVolumeDimension
  readonly evaluable: boolean
  readonly magnitude: SystematicVolumeMagnitude | null
  readonly coverage: SystematicVolumeCoverage
  readonly context: SystematicVolumePlanningContext
  readonly insufficientReasons: readonly SystematicVolumeInsufficientReason[]
  readonly contributingPlannedSessionIds: readonly string[]
  readonly contributingRealizedSessionIds: readonly string[]
  readonly unplannedRealizedSessionIds: readonly string[]
}

export interface SystematicVolumeSignal {
  readonly athleteId: string
  readonly dimension: SystematicVolumeDimension
  readonly pattern: SystematicVolumePattern
  /** Attention means review priority for the coach, never injury or physiological risk. */
  readonly attention: SystematicVolumeAttention
  readonly ruleVersion: typeof SYSTEMATIC_VOLUME_RULE_VERSION
  readonly current: SystematicVolumeMicrocycleEvidence | null
  readonly previousEvaluable: SystematicVolumeMicrocycleEvidence | null
  readonly contributingMicrocycleIds: readonly string[]
  readonly insufficientReasons: readonly SystematicVolumeInsufficientReason[]
}

export interface AthleteSystematicVolumeAssessment {
  readonly athleteId: string
  readonly ruleVersion: typeof SYSTEMATIC_VOLUME_RULE_VERSION
  readonly signals: Readonly<Record<SystematicVolumeDimension, SystematicVolumeSignal>>
  readonly primaryDimension: SystematicVolumeDimension | null
  readonly attention: SystematicVolumeAttention
}
