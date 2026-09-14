import type { RealizedMetricName } from '@/types/training/realized-training-capture.types'

export const TRAINING_LOAD_RULE_VERSION = 'srpe-duration-v1' as const

export interface TrainingLoadRuleConfig {
  readonly version: typeof TRAINING_LOAD_RULE_VERSION
  readonly method: 'session_rpe_duration'
  readonly unit: 'AU'
  readonly shortTermTimeConstantDays: 7
  readonly longTermTimeConstantDays: 42
  readonly minimumWarmupDays: 42
  readonly resetOnUnknownEvidence: true
  readonly requiredMetricFields: readonly ['durationMin', 'rpe']
}

export const TRAINING_LOAD_RULE_CONFIG: TrainingLoadRuleConfig = {
  version: TRAINING_LOAD_RULE_VERSION,
  method: 'session_rpe_duration',
  unit: 'AU',
  shortTermTimeConstantDays: 7,
  longTermTimeConstantDays: 42,
  minimumWarmupDays: 42,
  resetOnUnknownEvidence: true,
  requiredMetricFields: ['durationMin', 'rpe'],
}

export type DailyTrainingLoadEvidenceState =
  | 'confirmed_rest'
  | 'known_load'
  | 'unknown_load'
  | 'no_evidence'

export type TrainingLoadSeriesStatus = 'insufficient_data' | 'warming_up' | 'available'

export type TrainingLoadInsufficientReason =
  | 'no_reliable_evidence'
  | 'missing_duration'
  | 'missing_rpe'
  | 'ambiguous_rest'
  | 'insufficient_history'

export interface TrainingLoadExternalContext {
  readonly distanceM: number | null
  readonly elevationGainM: number | null
  readonly elevationLossM: number | null
}

export interface DailyTrainingLoad {
  readonly date: string
  readonly state: DailyTrainingLoadEvidenceState
  readonly loadAu: number | null
  readonly durationMin: number | null
  readonly rpe: number | null
  readonly external: TrainingLoadExternalContext
  readonly missingRequiredMetrics: readonly Extract<RealizedMetricName, 'durationMin' | 'rpe'>[]
  readonly sourceRecordIds: readonly string[]
}

export interface TrainingLoadCoverage {
  readonly observedDays: number
  readonly knownLoadDays: number
  readonly confirmedRestDays: number
  readonly unknownLoadDays: number
  readonly noEvidenceDays: number
  readonly usableDays: number
  readonly currentUsableStreakDays: number
  readonly coverageRatio: number | null
}

export interface TrainingLoadEvidenceWindow {
  readonly startDate: string
  readonly endDate: string
  readonly status: TrainingLoadSeriesStatus
  readonly insufficientReasons: readonly TrainingLoadInsufficientReason[]
  readonly coverage: TrainingLoadCoverage
  readonly days: readonly DailyTrainingLoad[]
}

export interface TrainingLoadTrendPoint {
  readonly date: string
  readonly dailyLoadAu: number | null
  readonly shortTermLoadAu: number | null
  readonly longTermLoadAu: number | null
  readonly loadBalanceAu: number | null
  readonly status: TrainingLoadSeriesStatus
}

export interface AthleteTrainingLoadState {
  readonly athleteId: string
  readonly startDate: string
  readonly endDate: string
  readonly ruleVersion: typeof TRAINING_LOAD_RULE_VERSION
  readonly status: TrainingLoadSeriesStatus
  readonly insufficientReasons: readonly TrainingLoadInsufficientReason[]
  readonly coverage: TrainingLoadCoverage
  readonly days: readonly DailyTrainingLoad[]
  readonly trend: readonly TrainingLoadTrendPoint[]
  readonly latest: TrainingLoadTrendPoint | null
}
