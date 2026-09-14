import type {
  ManualRealizedTrainingClientInput,
  ManualRealizedTrainingStatus,
  RealizedTrainingCaptureMetrics,
} from '@/types/training/realized-training-capture.types'

/** Immutable audit snapshot for one realized-training correction boundary. */
export interface RealizedTrainingCorrectionSnapshot {
  readonly sessionId: string | null
  readonly workoutId: string | null
  readonly date: string
  readonly performedAt: string | null
  readonly status: ManualRealizedTrainingStatus
  readonly metrics: RealizedTrainingCaptureMetrics
  readonly feeling: string | null
  readonly athleteNotes: string | null
}

/** Append-only audit record for a correction applied to one workout log. */
export interface RealizedTrainingCorrectionRecord {
  readonly id: string
  readonly workoutLogId: string
  readonly correctedByUserId: string
  readonly correctedAt: string
  readonly reason: string | null
  readonly before: RealizedTrainingCorrectionSnapshot
  readonly after: RealizedTrainingCorrectionSnapshot
}

/**
 * Server-scoped correction request. Ownership and actor identity are resolved
 * authoritatively; clients only submit the replacement state and optional reason.
 */
export interface ManualRealizedTrainingCorrectionInput {
  readonly workoutLogId: string
  readonly correctedByUserId: string
  readonly athleteId: string
  readonly reason: string | null
  readonly replacement: ManualRealizedTrainingClientInput
}

export type ManualRealizedTrainingCorrectionClientInput = Omit<
  ManualRealizedTrainingCorrectionInput,
  'correctedByUserId' | 'athleteId'
>
