import type {
  TrainingResponseAttention,
  TrainingResponseContributor,
  TrainingResponseDomain,
  TrainingResponseLimitation,
  TrainingResponseReason,
  TrainingResponseReview,
  TrainingResponseTemporalCompatibility,
} from '@/types'

export type TrainingResponseProjectionStatus = TrainingResponseAttention | 'unknown'
export type TrainingResponseCoverageState = 'available' | 'insufficient' | 'known_without_contributor'

export interface TrainingResponseDomainCoverage {
  readonly domain: TrainingResponseDomain
  readonly state: TrainingResponseCoverageState
}

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
  readonly coverage: readonly TrainingResponseDomainCoverage[]
  readonly temporalCompatibility: TrainingResponseTemporalCompatibility | null
  readonly ruleVersion: string
}

const DOMAINS: readonly TrainingResponseDomain[] = [
  'systematic_volume',
  'internal_load',
  'adherence',
]

const INSUFFICIENT_LIMITATION_BY_DOMAIN: Readonly<
  Record<TrainingResponseDomain, TrainingResponseLimitation>
> = {
  systematic_volume: 'systematic_volume_insufficient_data',
  internal_load: 'internal_load_insufficient_data',
  adherence: 'adherence_insufficient_data',
}

function projectionStatus(review: TrainingResponseReview): TrainingResponseProjectionStatus {
  const hasKnownContext = review.contributors.length > 0 || review.reasons.length > 0
  if (review.attention === 'none' && !hasKnownContext && review.limitations.length > 0) {
    return 'unknown'
  }
  return review.attention
}

function projectCoverage(review: TrainingResponseReview): TrainingResponseDomainCoverage[] {
  return DOMAINS.map(domain => {
    if (review.contributors.some(contributor => contributor.domain === domain)) {
      return { domain, state: 'available' }
    }

    if (review.limitations.includes(INSUFFICIENT_LIMITATION_BY_DOMAIN[domain])) {
      return { domain, state: 'insufficient' }
    }

    return { domain, state: 'known_without_contributor' }
  })
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
    coverage: projectCoverage(review),
    temporalCompatibility: review.temporalCompatibility,
    ruleVersion: review.convergenceRuleVersion,
  }
}
