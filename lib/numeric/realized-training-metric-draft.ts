import type { RealizedTrainingCaptureMetric } from '@/types/training/realized-training-capture.types'
import { parseRegionalNumericInput } from './regional-numeric-input'

export type RealizedTrainingMetricDraftKind = 'distanceKm' | 'elevationGainM' | 'avgHrBpm'

export type RealizedTrainingMetricDraftResult =
  | { readonly status: 'valid'; readonly metric: RealizedTrainingCaptureMetric }
  | { readonly status: 'invalid' }

/** Normalize entered metric representation, preserving unknown independently of known zero.
 * Domain-specific bounds and server authorization remain downstream.
 */
export function parseRealizedTrainingMetricDraft(
  raw: string,
  kind: RealizedTrainingMetricDraftKind,
): RealizedTrainingMetricDraftResult {
  const parsed = parseRegionalNumericInput(raw, kind === 'distanceKm'
    ? { kind: 'decimal', maxFractionDigits: 2 }
    : { kind: 'integer' })
  if (parsed.status === 'empty') return { status: 'valid', metric: { state: 'unknown' } }
  if (parsed.status !== 'valid') return { status: 'invalid' }
  return { status: 'valid', metric: { state: 'known', value: parsed.value } }
}
