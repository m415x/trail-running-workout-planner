import type { RealizedTrainingCaptureMetric } from '@/types/training/realized-training-capture.types'
import { parseRealizedTrainingMetricDraft } from './realized-training-metric-draft'

export interface RealizedTrainingMetricDrafts {
  readonly distance: string
  readonly gain: string
  readonly avgHr: string
}

export interface ValidatedRealizedTrainingMetrics {
  readonly distanceKm: RealizedTrainingCaptureMetric
  readonly elevationGainM: RealizedTrainingCaptureMetric
  readonly avgHrBpm: RealizedTrainingCaptureMetric
}

export type ValidatedSaveResult<T> =
  | { readonly status: 'invalid' }
  | { readonly status: 'completed'; readonly value: T }

/** The callback is never invoked for an invalid or unfinished metric draft. */
export async function withValidatedRealizedTrainingMetrics<T>(
  drafts: RealizedTrainingMetricDrafts,
  callback: (metrics: ValidatedRealizedTrainingMetrics) => Promise<T>,
): Promise<ValidatedSaveResult<T>> {
  const distance = parseRealizedTrainingMetricDraft(drafts.distance, 'distanceKm')
  const gain = parseRealizedTrainingMetricDraft(drafts.gain, 'elevationGainM')
  const avgHr = parseRealizedTrainingMetricDraft(drafts.avgHr, 'avgHrBpm')

  if (distance.status === 'invalid' || gain.status === 'invalid' || avgHr.status === 'invalid') {
    return { status: 'invalid' }
  }

  const value = await callback({
    distanceKm: distance.metric,
    elevationGainM: gain.metric,
    avgHrBpm: avgHr.metric,
  })
  return { status: 'completed', value }
}
