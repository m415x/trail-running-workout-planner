export const TRAINING_RESPONSE_CONVERGENCE_RULE_VERSION = 'training-response-convergence-v1' as const

export type TrainingResponseAttention = 'none' | 'info' | 'review' | 'priority'
export type TrainingResponseContributorRole = 'evidence' | 'context'
export type TrainingResponseDomain = 'systematic_volume' | 'internal_load' | 'adherence'
export type TrainingResponseTemporalCompatibility =
  | 'compatible'
  | 'not_compatible'
  | 'indeterminate'

export type TrainingResponseReason =
  | 'systematic_volume_excess'
  | 'isolated_systematic_volume_excess'
  | 'recent_internal_load_above_baseline'
  | 'declining_adherence_context'
  | 'compatible_independent_evidence'

export interface TrainingResponseEvidenceWindow {
  readonly startDate: string
  readonly endDate: string
}

export interface TrainingResponseContributor {
  readonly domain: TrainingResponseDomain
  readonly signal: string
  readonly role: TrainingResponseContributorRole
  readonly evidenceWindow: TrainingResponseEvidenceWindow | null
  readonly sourceRuleVersion: string
}

export type TrainingResponseLimitation =
  | 'systematic_volume_insufficient_data'
  | 'internal_load_insufficient_data'
  | 'adherence_insufficient_data'
  | 'temporal_compatibility_indeterminate'
  | 'evidence_not_temporally_compatible'

export interface TrainingResponseReview {
  readonly attention: TrainingResponseAttention
  readonly contributors: readonly TrainingResponseContributor[]
  readonly reasons: readonly TrainingResponseReason[]
  readonly limitations: readonly TrainingResponseLimitation[]
  readonly temporalCompatibility: TrainingResponseTemporalCompatibility | null
  readonly convergenceRuleVersion: typeof TRAINING_RESPONSE_CONVERGENCE_RULE_VERSION
}
