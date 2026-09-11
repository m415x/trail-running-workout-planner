import type {
  CompetitionAdjustmentCoachEdit,
  CompetitionAdjustmentReviewInput,
  ProtectedCompetitionAdjustmentField,
  ReviewedCompetitionAdjustmentProposal,
} from '@/types'

function assertNonNegative(value: number | null | undefined, field: string) {
  if (value !== undefined && value !== null && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${field} must be a finite non-negative number or null`)
  }
}

function assertEditable(
  edit: CompetitionAdjustmentCoachEdit,
  preservedFields: readonly ProtectedCompetitionAdjustmentField[],
) {
  const protectedEdits: Array<[keyof CompetitionAdjustmentCoachEdit, ProtectedCompetitionAdjustmentField]> = [
    ['type', 'microcycle_type'],
    ['targetVolumeKm', 'target_volume_km'],
    ['targetElevationGainM', 'target_elevation_gain_m'],
  ]

  for (const [editField, protectedField] of protectedEdits) {
    if (editField in edit && preservedFields.includes(protectedField)) {
      throw new Error(`Cannot edit protected field ${protectedField} for ${edit.microcycleId}`)
    }
  }
}

/**
 * Applies an explicit coach decision to a protection-aware proposal without
 * persistence. Accepted generated values remain generated; fields explicitly
 * changed by the coach become coach-owned in the review artifact.
 */
export function reviewCompetitionAdjustmentProposal(
  input: CompetitionAdjustmentReviewInput,
): ReviewedCompetitionAdjustmentProposal {
  const edits = input.edits ?? []

  if (input.decision === 'accepted' && edits.length > 0) {
    throw new Error('Accepted competition adjustment cannot contain coach edits')
  }

  if (input.decision === 'adjusted' && edits.length === 0) {
    throw new Error('Adjusted competition adjustment requires at least one coach edit')
  }

  const knownIds = new Set(input.proposal.affectedMicrocycles.map((item) => item.microcycleId))
  const seenIds = new Set<string>()

  for (const edit of edits) {
    if (!knownIds.has(edit.microcycleId)) {
      throw new Error(`Unknown competition adjustment microcycle ${edit.microcycleId}`)
    }
    if (seenIds.has(edit.microcycleId)) {
      throw new Error(`Duplicate competition adjustment edit for ${edit.microcycleId}`)
    }
    seenIds.add(edit.microcycleId)
    assertNonNegative(edit.targetVolumeKm, 'targetVolumeKm')
    assertNonNegative(edit.targetElevationGainM, 'targetElevationGainM')
  }

  const affectedMicrocycles = input.proposal.affectedMicrocycles.map((preview) => {
    const edit = edits.find((item) => item.microcycleId === preview.microcycleId)
    if (edit) assertEditable(edit, preview.preservedFields)

    return {
      microcycleId: preview.microcycleId,
      weekNumber: preview.weekNumber,
      phases: preview.phases,
      current: preview.current,
      reviewed: {
        ...preview.proposed,
        ...(edit && 'type' in edit ? { type: edit.type } : {}),
        ...(edit && 'targetVolumeKm' in edit ? { targetVolumeKm: edit.targetVolumeKm } : {}),
        ...(edit && 'targetElevationGainM' in edit
          ? { targetElevationGainM: edit.targetElevationGainM }
          : {}),
        ...(edit && 'allowIntenseSessions' in edit
          ? { allowIntenseSessions: edit.allowIntenseSessions }
          : {}),
      },
      reasonCodes: preview.reasonCodes,
      preservedFields: preview.preservedFields,
      valueSources: {
        type: edit && 'type' in edit ? 'coach' : 'generated',
        targetVolumeKm: edit && 'targetVolumeKm' in edit ? 'coach' : 'generated',
        targetElevationGainM: edit && 'targetElevationGainM' in edit ? 'coach' : 'generated',
        allowIntenseSessions: edit && 'allowIntenseSessions' in edit ? 'coach' : 'generated',
      },
    } as const
  })

  return {
    ...input.proposal,
    decision: input.decision,
    affectedMicrocycles,
    requiresCoachReview: false,
    reviewedAtBoundary: true,
  }
}
