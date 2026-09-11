import type {
  CompetitionAdjustmentAuditRecord,
  CompetitionAdjustmentReconciliation,
  CompetitionAdjustmentReconciliationInput,
  ReviewedCompetitionMicrocycleAdjustment,
} from '@/types'

function serialize(value: string | number | boolean | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function audit(
  input: CompetitionAdjustmentReconciliationInput,
  preview: ReviewedCompetitionMicrocycleAdjustment,
  field: CompetitionAdjustmentAuditRecord['field'],
  previousValue: string | number | null | undefined,
  newValue: string | number | null | undefined,
  source: CompetitionAdjustmentAuditRecord['source'],
): CompetitionAdjustmentAuditRecord | null {
  const previous = serialize(previousValue)
  const next = serialize(newValue)
  if (previous === next) return null

  return {
    groupTrainingPlanId: input.groupTrainingPlanId,
    competitionId: input.reviewedProposal.competitionId,
    microcycleId: preview.microcycleId,
    field,
    previousValue: previous,
    newValue: next,
    source,
    changedByUserId: input.changedByUserId ?? null,
  }
}

/**
 * Converts an explicitly reviewed competitive proposal into a persistence-ready
 * local patch plus audit records. It never reads or writes the database and it
 * cannot affect microcycles outside the reviewed impact window.
 */
export function reconcileReviewedCompetitionAdjustment(
  input: CompetitionAdjustmentReconciliationInput,
): CompetitionAdjustmentReconciliation {
  if (!input.reviewedProposal.reviewedAtBoundary) {
    throw new Error('Competition adjustment must pass coach review before reconciliation')
  }

  const patches = input.reviewedProposal.affectedMicrocycles.map((preview) => ({
    microcycleId: preview.microcycleId,
    type: preview.reviewed.type,
    targetVolumeKm: preview.reviewed.targetVolumeKm,
    targetElevationGainM: preview.reviewed.targetElevationGainM,
    valueSources: preview.valueSources,
  }))

  const auditRecords = input.reviewedProposal.affectedMicrocycles.flatMap((preview) => {
    const records = [
      audit(input, preview, 'type', preview.current.type, preview.reviewed.type, preview.valueSources.type),
      audit(
        input,
        preview,
        'target_volume_km',
        preview.current.targetVolumeKm,
        preview.reviewed.targetVolumeKm,
        preview.valueSources.targetVolumeKm,
      ),
      audit(
        input,
        preview,
        'target_elevation_gain',
        preview.current.targetElevationGainM,
        preview.reviewed.targetElevationGainM,
        preview.valueSources.targetElevationGainM,
      ),
    ]
    return records.filter((record): record is CompetitionAdjustmentAuditRecord => record !== null)
  })

  return {
    competitionId: input.reviewedProposal.competitionId,
    groupTrainingPlanId: input.groupTrainingPlanId,
    window: input.reviewedProposal.window,
    patches,
    auditRecords,
  }
}
