import type { ReviewedCompetitionAdjustmentProposal } from '@/types/training/competition-adjustment-review.types'
import type { MicrocycleType, PlanningModificationField } from '@/types/training/periodization.types'

export type CompetitionAdjustmentAppliedValueSource = 'generated' | 'coach'

export interface CompetitionAdjustmentReconciliationInput {
  readonly groupTrainingPlanId: string
  readonly reviewedProposal: ReviewedCompetitionAdjustmentProposal
  readonly changedByUserId?: string | null
}

export interface CompetitionAdjustmentMicrocyclePatch {
  readonly microcycleId: string
  readonly type: MicrocycleType
  readonly targetVolumeKm: number | null
  readonly targetElevationGainM: number | null
  readonly valueSources: ReviewedCompetitionAdjustmentProposal['affectedMicrocycles'][number]['valueSources']
}

export interface CompetitionAdjustmentAuditRecord {
  readonly groupTrainingPlanId: string
  readonly competitionId: string
  readonly microcycleId: string
  readonly field: PlanningModificationField
  readonly previousValue: string | null
  readonly newValue: string | null
  readonly source: CompetitionAdjustmentAppliedValueSource
  readonly changedByUserId: string | null
}

/**
 * Persistence-ready result for KAN-222. Only microcycles inside the reviewed
 * competitive window are represented. Database mutation remains outside this
 * pure domain boundary so adapters can apply the patch transactionally.
 */
export interface CompetitionAdjustmentReconciliation {
  readonly competitionId: string
  readonly groupTrainingPlanId: string
  readonly window: ReviewedCompetitionAdjustmentProposal['window']
  readonly patches: readonly CompetitionAdjustmentMicrocyclePatch[]
  readonly auditRecords: readonly CompetitionAdjustmentAuditRecord[]
}
