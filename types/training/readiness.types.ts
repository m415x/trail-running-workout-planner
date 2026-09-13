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

/**
 * Raw persistence-facing shape consumed by the H12 normalization boundary.
 *
 * `knownMetricFields` is deliberate. Existing workout_logs rows cannot prove
 * whether a persisted zero was observed or merely came from a schema/UI default.
 * New writers must declare which numeric fields the athlete actually supplied.
 */
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
