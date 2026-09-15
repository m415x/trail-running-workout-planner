import {
  TRAINING_RESPONSE_CONVERGENCE_RULE_VERSION,
  type TrainingResponseAttention,
  type TrainingResponseContributor,
  type TrainingResponseEvidenceWindow,
  type TrainingResponseLimitation,
  type TrainingResponseReason,
  type TrainingResponseReview,
  type TrainingResponseTemporalCompatibility,
} from '@/types'

export interface ComposeTrainingResponseReviewInput {
  readonly contributors: readonly TrainingResponseContributor[]
  readonly limitations: readonly TrainingResponseLimitation[]
}

const DOMAIN_ORDER: Readonly<Record<TrainingResponseContributor['domain'], number>> = {
  systematic_volume: 0,
  internal_load: 1,
  adherence: 2,
}

const ATTENTION_ORDER: Readonly<Record<TrainingResponseAttention, number>> = {
  none: 0,
  info: 1,
  review: 2,
  priority: 3,
}

function standaloneAttention(contributor: TrainingResponseContributor): TrainingResponseAttention {
  if (contributor.role === 'context') return 'none'

  if (contributor.domain === 'systematic_volume') {
    if (contributor.signal === 'systematic_excess') return 'review'
    if (contributor.signal === 'isolated_excess') return 'info'
  }

  if (
    contributor.domain === 'internal_load' &&
    contributor.signal === 'recent_load_above_baseline'
  ) {
    return 'info'
  }

  return 'none'
}

function reasonForContributor(
  contributor: TrainingResponseContributor,
): TrainingResponseReason | null {
  if (contributor.domain === 'systematic_volume' && contributor.role === 'evidence') {
    if (contributor.signal === 'systematic_excess') return 'systematic_volume_excess'
    if (contributor.signal === 'isolated_excess') return 'isolated_systematic_volume_excess'
  }

  if (
    contributor.domain === 'internal_load' &&
    contributor.role === 'evidence' &&
    contributor.signal === 'recent_load_above_baseline'
  ) {
    return 'recent_internal_load_above_baseline'
  }

  if (
    contributor.domain === 'adherence' &&
    contributor.role === 'context' &&
    contributor.signal === 'declining'
  ) {
    return 'declining_adherence_context'
  }

  return null
}

function reasonsForContributors(
  contributors: readonly TrainingResponseContributor[],
): TrainingResponseReason[] {
  const reasons: TrainingResponseReason[] = []

  for (const contributor of contributors) {
    const reason = reasonForContributor(contributor)
    if (reason !== null && !reasons.includes(reason)) reasons.push(reason)
  }

  return reasons
}

function maxAttention(contributors: readonly TrainingResponseContributor[]): TrainingResponseAttention {
  return contributors.reduce<TrainingResponseAttention>((current, contributor) => {
    const candidate = standaloneAttention(contributor)
    return ATTENTION_ORDER[candidate] > ATTENTION_ORDER[current] ? candidate : current
  }, 'none')
}

function compareWindows(
  left: TrainingResponseEvidenceWindow | null,
  right: TrainingResponseEvidenceWindow | null,
): TrainingResponseTemporalCompatibility {
  if (left === null || right === null) return 'indeterminate'

  return left.startDate <= right.endDate && right.startDate <= left.endDate
    ? 'compatible'
    : 'not_compatible'
}

function withLimitation(
  limitations: readonly TrainingResponseLimitation[],
  limitation: TrainingResponseLimitation,
): readonly TrainingResponseLimitation[] {
  return limitations.includes(limitation) ? limitations : [...limitations, limitation]
}

function sortContributors(
  contributors: readonly TrainingResponseContributor[],
): readonly TrainingResponseContributor[] {
  return contributors
    .map((contributor, index) => ({ contributor, index }))
    .sort((left, right) => {
      const domainDifference = DOMAIN_ORDER[left.contributor.domain] - DOMAIN_ORDER[right.contributor.domain]
      return domainDifference !== 0 ? domainDifference : left.index - right.index
    })
    .map(({ contributor }) => contributor)
}

/**
 * Composes already-derived semantic signals into coach-review attention.
 * This layer does not reinterpret source metrics or produce physiological diagnoses.
 */
export function composeTrainingResponseReview(
  input: ComposeTrainingResponseReviewInput,
): TrainingResponseReview {
  const contributors = sortContributors(input.contributors)
  let attention = maxAttention(contributors)
  let limitations: readonly TrainingResponseLimitation[] = [...input.limitations]
  const reasons = reasonsForContributors(contributors)

  const systematicExcess = contributors.find(
    ({ domain, role, signal }) =>
      domain === 'systematic_volume' && role === 'evidence' && signal === 'systematic_excess',
  )
  const elevatedInternalLoad = contributors.find(
    ({ domain, role, signal }) =>
      domain === 'internal_load' && role === 'evidence' && signal === 'recent_load_above_baseline',
  )

  let temporalCompatibility: TrainingResponseTemporalCompatibility | null = null

  if (systematicExcess && elevatedInternalLoad) {
    temporalCompatibility = compareWindows(
      systematicExcess.evidenceWindow,
      elevatedInternalLoad.evidenceWindow,
    )

    if (temporalCompatibility === 'compatible') {
      attention = 'priority'
      reasons.push('compatible_independent_evidence')
    } else if (temporalCompatibility === 'not_compatible') {
      limitations = withLimitation(limitations, 'evidence_not_temporally_compatible')
    } else {
      limitations = withLimitation(limitations, 'temporal_compatibility_indeterminate')
    }
  }

  return {
    attention,
    contributors,
    reasons,
    limitations,
    temporalCompatibility,
    convergenceRuleVersion: TRAINING_RESPONSE_CONVERGENCE_RULE_VERSION,
  }
}
