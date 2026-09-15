import type { RealizedTrainingRecord } from '@/types/training/readiness.types'

export type RealizedTrainingMetricSummary =
  | {
      readonly state: 'available'
      readonly value: number
      readonly knownRecords: number
      readonly observedRecords: number
    }
  | {
      readonly state: 'unknown'
      readonly reason: 'no_realized_evidence' | 'metric_not_observed'
      readonly knownRecords: number
      readonly observedRecords: number
    }

export type RealizedTrainingFrequencySummary =
  | { readonly state: 'available'; readonly value: number }
  | { readonly state: 'unknown'; readonly reason: 'no_realized_evidence' }

export interface RealizedTrainingSummary {
  readonly frequency: RealizedTrainingFrequencySummary
  readonly distance: RealizedTrainingMetricSummary
  readonly duration: RealizedTrainingMetricSummary
  readonly elevation: RealizedTrainingMetricSummary
}

type MetricName = 'distanceKm' | 'durationMin' | 'elevationGainM'

function summarizeMetric(
  records: readonly RealizedTrainingRecord[],
  metricName: MetricName,
): RealizedTrainingMetricSummary {
  if (records.length === 0) {
    return {
      state: 'unknown',
      reason: 'no_realized_evidence',
      knownRecords: 0,
      observedRecords: 0,
    }
  }

  const knownValues = records.flatMap((record) => {
    const metric = record.metrics[metricName]
    return metric.state === 'known' ? [metric.value] : []
  })

  if (knownValues.length === 0) {
    return {
      state: 'unknown',
      reason: 'metric_not_observed',
      knownRecords: 0,
      observedRecords: records.length,
    }
  }

  return {
    state: 'available',
    value: knownValues.reduce((sum, value) => sum + value, 0),
    knownRecords: knownValues.length,
    observedRecords: records.length,
  }
}

export function summarizeRealizedTraining(
  records: readonly RealizedTrainingRecord[],
): RealizedTrainingSummary {
  return {
    frequency:
      records.length === 0
        ? { state: 'unknown', reason: 'no_realized_evidence' }
        : { state: 'available', value: records.length },
    distance: summarizeMetric(records, 'distanceKm'),
    duration: summarizeMetric(records, 'durationMin'),
    elevation: summarizeMetric(records, 'elevationGainM'),
  }
}
