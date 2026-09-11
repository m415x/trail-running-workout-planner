import type { ProtectedCompetitionAdjustmentProposal } from '@/types/training/competition-adjustment-protection.types'
import type { MicrocycleType } from '@/types/training/periodization.types'

export type CompetitionAdjustmentReviewDecision = 'accepted' | 'adjusted'
export type CompetitionAdjustmentReviewedValueSource = 'generated' | 'coach'

export interface CompetitionAdjustmentCoachEdit {
  readonly microcycleId: string
  readonly type?: MicrocycleType
  readonly targetVolumeKm?: number | null
  readonly targetElevationGainM?: number | null
  readonly allowIntenseSessions?: boolean | null
}

export interface CompetitionAdjustmentReviewInput {
  readonly proposal: ProtectedCompetitionAdjustmentProposal
  readonly decision: CompetitionAdjustmentReviewDecision
  readonly edits?: readonly CompetitionAdjustmentCoachEdit[]
}

export interface ReviewedCompetitionMicrocycleAdjustment {
  readonly microcycleId: string
  readonly weekNumber: number
  readonly phases: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['phases']
  readonly current: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['current']
  readonly reviewed: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['proposed']
  readonly reasonCodes: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['reasonCodes']
  readonly preservedFields: ProtectedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['preservedFields']
  readonly valueSources: {
    readonly type: CompetitionAdjustmentReviewedValueSource
    readonly targetVolumeKm: CompetitionAdjustmentReviewedValueSource
    readonly targetElevationGainM: CompetitionAdjustmentReviewedValueSource
    readonly allowIntenseSessions: CompetitionAdjustmentReviewedValueSource
  }
}

/**
 * Explicit coach decision over an inspectable, protection-aware proposal.
 * This remains a pure review artifact; persistence is handled by later H10 work.
 */
export interface ReviewedCompetitionAdjustmentProposal
  extends Omit<ProtectedCompetitionAdjustmentProposal, 'affectedMicrocycles' | 'requiresCoachReview'> {
  readonly decision: CompetitionAdjustmentReviewDecision
  readonly affectedMicrocycles: readonly ReviewedCompetitionMicrocycleAdjustment[]
  readonly requiresCoachReview: false
  readonly reviewedAtBoundary: true
}
