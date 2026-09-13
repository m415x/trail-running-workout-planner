import type { DayStatus } from '@/types/training/workout.types'

export type RealizedTrainingSource = 'manual' | 'imported'

export type RealizedMetricName =
  | 'distanceKm'
  | 'durationMin'
  | 'elevationGainM'
  | 'avgHrBpm'
  | 'rpe'

export type RealizedMetricUnknownReason =
  | 'not_recorded'
  | 'legacy_zero_ambiguous'
  | 'invalid_value'

export type RealizedMetric<T extends number = number> =
  | {
      readonly state: 'known'
      readonly value: T
    }
  | {
      readonly state: 'unknown'
      readonly reason: RealizedMetricUnknownReason
    }

export type RealizedTrainingQuality =
  | 'usable'
  | 'partial'
  | 'non_exposure'
  | 'explicit_missed'
  | 'ambiguous'

export interface RawRealizedTrainingRecord {
  readonly id: string
  readonly teamId: string
  readonly athleteId: string
  readonly sessionId: string | null
  readonly workoutId: string | null
  readonly date: string
  readonly status: DayStatus
  readonly distanceKm: number | null
  readonly durationMin: number | null
  readonly elevationGainM: number | null
  readonly avgHrBpm: number | null
  readonly rpe: number | null
  readonly loggedAt: string
  readonly source: RealizedTrainingSource
  readonly sourceActivityId: string | null
  readonly knownMetricFields: readonly RealizedMetricName[] | null
}

export interface RealizedTrainingProvenance {
  readonly source: RealizedTrainingSource
  readonly sourceActivityId: string | null
  readonly loggedAt: string
  readonly sessionLink: 'explicit' | 'none'
}

export interface RealizedTrainingMetrics {
  readonly distanceKm: RealizedMetric
  readonly durationMin: RealizedMetric
  readonly elevationGainM: RealizedMetric
  readonly avgHrBpm: RealizedMetric
  readonly rpe: RealizedMetric
}

export interface RealizedTrainingRecord {
  readonly id: string
  readonly teamId: string
  readonly athleteId: string
  readonly sessionId: string | null
  readonly workoutId: string | null
  readonly date: string
  readonly status: DayStatus
  readonly metrics: RealizedTrainingMetrics
  readonly provenance: RealizedTrainingProvenance
  readonly quality: RealizedTrainingQuality
  readonly limitations: readonly string[]
}

export interface RealizedTrainingDeduplicationResult {
  readonly records: readonly RealizedTrainingRecord[]
  readonly duplicateRecordIds: readonly string[]
  readonly ambiguousRecordIds: readonly string[]
}

export interface ReadinessAnalysisWindow {
  readonly startDate: string
  readonly endDate: string
  readonly windowDays: number
  readonly bucketDays: number
}

export interface ReadinessDataSufficiencyPolicy {
  readonly lookbackDays: number
  readonly bucketDays: number
  readonly minimumPerformedSessions: number
  readonly minimumActiveBuckets: number
  readonly minimumMetricCoverageRatio: number
}

export type ReadinessDataInsufficiencyReason =
  | 'no_performed_records'
  | 'too_few_performed_sessions'
  | 'too_few_active_buckets'
  | 'metric_coverage_below_threshold'

export interface RealizedMetricCoverage {
  readonly metric: RealizedMetricName
  readonly knownRecords: number
  readonly performedRecords: number
  readonly ratio: number
  readonly sufficient: boolean
}

export interface ReadinessDataCoverage {
  readonly window: ReadinessAnalysisWindow
  readonly performedRecords: number
  readonly activeBuckets: number
  readonly totalBuckets: number
  readonly explicitMissedRecords: number
  readonly ambiguousRecords: number
  readonly metrics: Readonly<Record<RealizedMetricName, RealizedMetricCoverage>>
}

export type ReadinessDataSufficiency =
  | {
      readonly status: 'sufficient'
      readonly coverage: ReadinessDataCoverage
    }
  | {
      readonly status: 'insufficient_data'
      readonly coverage: ReadinessDataCoverage
      readonly reasons: readonly ReadinessDataInsufficiencyReason[]
    }

export type PreparationSummaryUnit =
  | 'km'
  | 'km_per_week'
  | 'min'
  | 'min_per_week'
  | 'm'
  | 'm_per_week'
  | 'sessions_per_week'
  | 'ratio'
  | 'bpm'
  | 'rpe'

export type PreparationSummaryValue =
  | {
      readonly state: 'known'
      readonly value: number
      readonly unit: PreparationSummaryUnit
      readonly sampleSize: number
      readonly coverageRatio: number
    }
  | {
      readonly state: 'unknown'
      readonly unit: PreparationSummaryUnit
      readonly sampleSize: number
      readonly coverageRatio: number
      readonly reason: 'insufficient_data' | 'insufficient_metric_coverage'
    }

export interface RecentPreparationSummary {
  readonly teamId: string
  readonly athleteId: string
  readonly window: ReadinessAnalysisWindow
  readonly dataStatus: ReadinessDataSufficiency['status']
  readonly performedRecords: number
  readonly volume: {
    readonly totalKm: PreparationSummaryValue
    readonly averageWeeklyKm: PreparationSummaryValue
  }
  readonly duration: {
    readonly totalMin: PreparationSummaryValue
    readonly averageWeeklyMin: PreparationSummaryValue
  }
  readonly elevation: {
    readonly totalGainM: PreparationSummaryValue
    readonly averageWeeklyGainM: PreparationSummaryValue
  }
  /** Frequency of recorded performed activities; missing logs are never inferred as missed sessions. */
  readonly frequency: {
    readonly recordedSessionsPerWeek: PreparationSummaryValue
  }
  readonly intensity: {
    readonly averageRpe: PreparationSummaryValue
    readonly averageHrBpm: PreparationSummaryValue
  }
  readonly longRun: {
    readonly longestDistanceKm: PreparationSummaryValue
    readonly longestDurationMin: PreparationSummaryValue
  }
  readonly continuity: {
    readonly activeBucketRatio: PreparationSummaryValue
    readonly activeBuckets: number
    readonly totalBuckets: number
  }
  readonly limitations: readonly string[]
}
