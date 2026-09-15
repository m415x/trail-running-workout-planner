import type {
  TrainingResponseAttention,
  TrainingResponseContributor,
  TrainingResponseLimitation,
  TrainingResponseReason,
  TrainingResponseReview,
  TrainingResponseTemporalCompatibility,
} from '@/types'

export type TrainingResponseProjectionStatus = TrainingResponseAttention | 'unknown'

export interface TrainingResponseCompactProjection {
  readonly status: TrainingResponseProjectionStatus
  readonly primaryReason: TrainingResponseReason | null
  readonly hasLimitations: boolean
  readonly ruleVersion: string
}

export interface TrainingResponseDetailProjection {
  readonly status: TrainingResponseProjectionStatus
  readonly reasons: readonly TrainingResponseReason[]
  readonly contributors: readonly TrainingResponseContributor[]
  readonly unknowns: readonly TrainingResponseLimitation[]
  readonly temporalCompatibility: TrainingResponseTemporalCompatibility | null
  readonly ruleVersion: string
}

function projectionStatus(review: TrainingResponseReview): TrainingResponseProjectionStatus {
  const hasKnownContext = review.contributors.length > 0 || review.reasons.length > 0
  if (review.attention === 'none' && !hasKnownContext && review.limitations.length > 0) {
    return 'unknown'
  }
  return review.attention
}

export function projectTrainingResponseCompact(
  review: TrainingResponseReview,
): TrainingResponseCompactProjection {
  return {
    status: projectionStatus(review),
    primaryReason: review.reasons[0] ?? null,
    hasLimitations: review.limitations.length > 0,
    ruleVersion: review.convergenceRuleVersion,
  }
}

export function projectTrainingResponseDetail(
  review: TrainingResponseReview,
): TrainingResponseDetailProjection {
  return {
    status: projectionStatus(review),
    reasons: [...review.reasons],
    contributors: [...review.contributors],
    unknowns: [...review.limitations],
    temporalCompatibility: review.temporalCompatibility,
    ruleVersion: review.convergenceRuleVersion,
  }
}
