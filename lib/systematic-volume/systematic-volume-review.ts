import type {
  AcknowledgeSystematicVolumeSignalInput,
  SystematicVolumeSignalReview,
} from '@/types/training/systematic-volume-review.types'

/**
 * Creates an audit snapshot of the coach's review. This function intentionally
 * has no access to planning or realized-training mutations: acknowledging a
 * signal records a human decision but never changes the calculated evidence.
 */
export function acknowledgeSystematicVolumeSignal(
  input: AcknowledgeSystematicVolumeSignalInput,
): SystematicVolumeSignalReview {
  return {
    athleteId: input.athleteId,
    dimension: input.dimension,
    microcycleId: input.microcycleId,
    ruleVersion: input.ruleVersion,
    patternAtReview: input.patternAtReview,
    status: 'acknowledged',
    acknowledgedBy: input.coachUserId,
    acknowledgedAt: input.acknowledgedAt,
    note: input.note?.trim() || null,
  }
}

export function systematicVolumeReviewKey(
  review: Pick<
    SystematicVolumeSignalReview,
    'athleteId' | 'dimension' | 'microcycleId' | 'ruleVersion' | 'patternAtReview'
  >,
): string {
  return [
    review.athleteId,
    review.dimension,
    review.microcycleId,
    review.ruleVersion,
    review.patternAtReview,
  ].join(':')
}
