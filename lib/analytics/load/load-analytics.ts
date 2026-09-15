import type {
  AthleteTrainingLoadState,
  TrainingLoadInsufficientReason,
  TrainingLoadTrendPoint,
} from '@/types/training/training-load.types'

export type LoadAnalyticsProjection =
  | {
      readonly state: 'available'
      readonly startDate: string
      readonly endDate: string
      readonly ruleVersion: string
      readonly coverageRatio: number | null
      readonly latest: TrainingLoadTrendPoint
      readonly trend: readonly TrainingLoadTrendPoint[]
    }
  | {
      readonly state: 'insufficient_data'
      readonly startDate: string
      readonly endDate: string
      readonly ruleVersion: string
      readonly coverageRatio: number | null
      readonly reasons: readonly TrainingLoadInsufficientReason[]
      readonly latest: null
      readonly trend: readonly TrainingLoadTrendPoint[]
    }

/**
 * Analytics projection only. It deliberately consumes the existing KAN-344
 * load series and never derives or reinterprets training load.
 */
export function projectLoadAnalytics(
  source: AthleteTrainingLoadState,
): LoadAnalyticsProjection {
  if (source.status !== 'available' || source.latest === null || source.latest.status !== 'available') {
    return {
      state: 'insufficient_data',
      startDate: source.startDate,
      endDate: source.endDate,
      ruleVersion: source.ruleVersion,
      coverageRatio: source.coverage.coverageRatio,
      reasons: source.insufficientReasons,
      latest: null,
      trend: [],
    }
  }

  return {
    state: 'available',
    startDate: source.startDate,
    endDate: source.endDate,
    ruleVersion: source.ruleVersion,
    coverageRatio: source.coverage.coverageRatio,
    latest: source.latest,
    trend: source.trend,
  }
}
