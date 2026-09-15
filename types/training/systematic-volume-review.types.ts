import type {
  SystematicVolumeDimension,
  SystematicVolumePattern,
} from '@/types/training/systematic-volume-excess.types'

export type SystematicVolumeReviewStatus = 'unreviewed' | 'acknowledged'

/**
 * Human workflow state attached to a derived signal snapshot.
 * Acknowledgment never mutates or resolves the underlying plan-real evidence.
 */
export interface SystematicVolumeSignalReview {
  readonly athleteId: string
  readonly dimension: SystematicVolumeDimension
  readonly microcycleId: string
  readonly ruleVersion: string
  readonly patternAtReview: SystematicVolumePattern
  readonly status: SystematicVolumeReviewStatus
  readonly acknowledgedBy: string | null
  readonly acknowledgedAt: string | null
  readonly note: string | null
}

export interface AcknowledgeSystematicVolumeSignalInput {
  readonly athleteId: string
  readonly dimension: SystematicVolumeDimension
  readonly microcycleId: string
  readonly ruleVersion: string
  readonly patternAtReview: SystematicVolumePattern
  readonly coachUserId: string
  readonly acknowledgedAt: string
  readonly note?: string | null
}
