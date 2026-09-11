import type {
  CompetitionAdjustmentProposal,
  CompetitionMicrocycleAdjustmentPreview,
} from '@/types/training/competition-adjustment-proposal.types'
import type { MicrocycleType, TargetValueSource } from '@/types/training/periodization.types'

export type ProtectedCompetitionAdjustmentField =
  | 'target_volume_km'
  | 'target_elevation_gain_m'
  | 'microcycle_type'
  | 'objective'
  | 'session'

export type CompetitionAdjustmentProtectionReason =
  | 'manual_value'
  | 'protected_microcycle'
  | 'protected_objective'
  | 'protected_session'

export interface CompetitionAdjustmentProtectedState {
  readonly microcycleId: string
  readonly protectMicrocycle?: boolean
  readonly protectObjective?: boolean
  readonly protectedSessionIds?: readonly string[]
}

export interface CompetitionAdjustmentProtectionConflict {
  readonly code: 'protected_planning_preserved'
  readonly microcycleId: string
  readonly field: ProtectedCompetitionAdjustmentField
  readonly reason: CompetitionAdjustmentProtectionReason
  readonly messageKey: 'competitionAdjustment.conflicts.protectedPlanningPreserved'
}

export interface CompetitionAdjustmentProtectionInput {
  readonly proposal: CompetitionAdjustmentProposal
  readonly protectedState?: readonly CompetitionAdjustmentProtectedState[]
}

export interface ProtectedCompetitionMicrocycleAdjustmentPreview
  extends CompetitionMicrocycleAdjustmentPreview {
  readonly proposed: CompetitionMicrocycleAdjustmentPreview['proposed'] & {
    readonly type: MicrocycleType
  }
  readonly preservedFields: readonly ProtectedCompetitionAdjustmentField[]
}

export interface ProtectedCompetitionAdjustmentProposal
  extends Omit<CompetitionAdjustmentProposal, 'affectedMicrocycles' | 'requiresCoachReview'> {
  readonly affectedMicrocycles: readonly ProtectedCompetitionMicrocycleAdjustmentPreview[]
  readonly protectionConflicts: readonly CompetitionAdjustmentProtectionConflict[]
  readonly requiresCoachReview: boolean
}

/** Explicit ownership metadata already present on microcycle target values. */
export interface CompetitionAdjustmentTargetOwnership {
  readonly targetVolumeSource: TargetValueSource
  readonly targetElevationSource: TargetValueSource
}
