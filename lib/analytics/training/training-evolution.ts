import {
  compareAnalyticsMetric,
  type AnalyticsEvidenceValue,
  type AnalyticsMetricComparison,
} from '@/lib/analytics/shared/analytics-primitives'
import type {
  RealizedTrainingFrequencySummary,
  RealizedTrainingMetricSummary,
  RealizedTrainingSummary,
} from '@/lib/analytics/training/training-analytics'

export interface RealizedTrainingEvolution {
  readonly frequency: AnalyticsMetricComparison
  readonly distance: AnalyticsMetricComparison
  readonly duration: AnalyticsMetricComparison
  readonly elevation: AnalyticsMetricComparison
}

function metricEvidence(summary: RealizedTrainingMetricSummary): AnalyticsEvidenceValue {
  return summary.state === 'available'
    ? { state: 'available', value: summary.value }
    : { state: 'unknown' }
}

function frequencyEvidence(summary: RealizedTrainingFrequencySummary): AnalyticsEvidenceValue {
  return summary.state === 'available'
    ? { state: 'available', value: summary.value }
    : { state: 'unknown' }
}

export function compareRealizedTraining(
  current: RealizedTrainingSummary,
  previous: RealizedTrainingSummary,
): RealizedTrainingEvolution {
  return {
    frequency: compareAnalyticsMetric(
      frequencyEvidence(current.frequency),
      frequencyEvidence(previous.frequency),
    ),
    distance: compareAnalyticsMetric(
      metricEvidence(current.distance),
      metricEvidence(previous.distance),
    ),
    duration: compareAnalyticsMetric(
      metricEvidence(current.duration),
      metricEvidence(previous.duration),
    ),
    elevation: compareAnalyticsMetric(
      metricEvidence(current.elevation),
      metricEvidence(previous.elevation),
    ),
  }
}
