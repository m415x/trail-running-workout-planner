import type {
  CompetitionBAdjustmentProposal,
  CompetitionWeekTrainingLoad,
  FullCompetitionATaperProposal,
} from '@/types/training/competitive-adjustment.types'
import type { CompetitionCAdjustmentProposal } from '@/types/training/competition-c-adjustment.types'
import type {
  CompetitionImpactOverlap,
  CompetitionImpactWindow,
} from '@/types/training/competition-impact-window.types'
import type { Microcycle, MicrocycleType } from '@/types/training/periodization.types'
import type { RecoveryDecision } from '@/types/training/recovery-adjustment.types'

export type CompetitionSourceAdjustmentProposal =
  | FullCompetitionATaperProposal
  | CompetitionBAdjustmentProposal
  | CompetitionCAdjustmentProposal

export type CompetitionMicrocycleImpactPhase = 'pre' | 'race' | 'post'

export type CompetitionMicrocycleAdjustmentReasonCode =
  | 'taper_volume_ceiling'
  | 'taper_elevation_ceiling'
  | 'race_week_training_separated'
  | 'post_race_recovery_ceiling'
  | 'post_race_intensity_restricted'

export interface CompetitionMicrocycleAdjustmentPreview {
  readonly microcycleId: string
  readonly weekNumber: number
  readonly current: {
    readonly type: MicrocycleType
    readonly targetVolumeKm: number | null
    readonly targetElevationGainM: number | null
  }
  readonly phases: readonly CompetitionMicrocycleImpactPhase[]
  readonly proposed: {
    readonly type: MicrocycleType
    readonly targetVolumeKm: number | null
    readonly targetElevationGainM: number | null
    readonly allowIntenseSessions: boolean | null
  }
  readonly reasonCodes: readonly CompetitionMicrocycleAdjustmentReasonCode[]
}

export type CompetitionAdjustmentConflictCode =
  | 'competition_window_overlap_requires_review'

export interface CompetitionAdjustmentConflict {
  readonly code: CompetitionAdjustmentConflictCode
  readonly relatedCompetitionIds: readonly string[]
  readonly messageKey: 'competitionAdjustment.conflicts.overlapRequiresReview'
}

export interface CompetitionAdjustmentProposalInput {
  readonly source: CompetitionSourceAdjustmentProposal
  readonly recovery: RecoveryDecision
  readonly existingMicrocycles: readonly Microcycle[]
  /** Optional calendar-level overlap resolution from KAN-218. */
  readonly overlaps?: readonly CompetitionImpactOverlap[]
}

/**
 * Pure, inspectable proposal generated before any persistence or ownership
 * reconciliation. KAN-220 enriches this object with manual/provenance conflicts.
 */
export interface CompetitionAdjustmentProposal {
  readonly competitionId: string
  readonly competitionDate: string
  readonly priority: CompetitionSourceAdjustmentProposal['priority']
  readonly window: CompetitionImpactWindow
  readonly source: CompetitionSourceAdjustmentProposal
  readonly recovery: RecoveryDecision
  readonly affectedMicrocycles: readonly CompetitionMicrocycleAdjustmentPreview[]
  readonly conflicts: readonly CompetitionAdjustmentConflict[]
  readonly requiresCoachReview: boolean
  readonly rationale: {
    readonly taperDurationDays: number
    readonly recoveryDurationDays: number
    readonly demandBand: CompetitionSourceAdjustmentProposal['demand']['band']
    readonly competitionWeekTraining: CompetitionWeekTrainingLoad
  }
}
