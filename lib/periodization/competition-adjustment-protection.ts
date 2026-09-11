import type {
  CompetitionAdjustmentProtectionConflict,
  CompetitionAdjustmentProtectionInput,
  CompetitionAdjustmentProtectedState,
  ProtectedCompetitionAdjustmentProposal,
  ProtectedCompetitionAdjustmentField,
  ProtectedCompetitionMicrocycleAdjustmentPreview,
} from '@/types'

function conflict(
  microcycleId: string,
  field: CompetitionAdjustmentProtectionConflict['field'],
  reason: CompetitionAdjustmentProtectionConflict['reason'],
  relatedEntityIds: readonly string[] = [],
): CompetitionAdjustmentProtectionConflict {
  return {
    code: 'protected_planning_preserved',
    microcycleId,
    field,
    reason,
    relatedEntityIds,
    messageKey: 'competitionAdjustment.conflicts.protectedPlanningPreserved',
  }
}

function stateFor(
  states: readonly CompetitionAdjustmentProtectedState[],
  microcycleId: string,
) {
  return states.find((state) => state.microcycleId === microcycleId)
}

/**
 * Reconciles an inspectable competition proposal with explicit coach ownership.
 * Manual/generated target provenance and structural protections are supplied by
 * the caller from persisted planning state. Nothing is persisted here.
 */
export function preserveProtectedCompetitionPlanning(
  input: CompetitionAdjustmentProtectionInput,
): ProtectedCompetitionAdjustmentProposal {
  const states = input.protectedState ?? []
  const protectionConflicts: CompetitionAdjustmentProtectionConflict[] = []

  const affectedMicrocycles = input.proposal.affectedMicrocycles.map((preview) => {
    const state = stateFor(states, preview.microcycleId)
    const preservedFields: ProtectedCompetitionAdjustmentField[] = []
    let type = preview.proposed.type
    let targetVolumeKm = preview.proposed.targetVolumeKm
    let targetElevationGainM = preview.proposed.targetElevationGainM

    if (state?.protectMicrocycle && type !== preview.current.type) {
      type = preview.current.type
      preservedFields.push('microcycle_type')
      protectionConflicts.push(conflict(
        preview.microcycleId,
        'microcycle_type',
        'protected_microcycle',
      ))
    }

    if (state?.targetVolumeSource === 'manual' && targetVolumeKm !== preview.current.targetVolumeKm) {
      targetVolumeKm = preview.current.targetVolumeKm
      preservedFields.push('target_volume_km')
      protectionConflicts.push(conflict(preview.microcycleId, 'target_volume_km', 'manual_value'))
    }

    if (
      state?.targetElevationSource === 'manual'
      && targetElevationGainM !== preview.current.targetElevationGainM
    ) {
      targetElevationGainM = preview.current.targetElevationGainM
      preservedFields.push('target_elevation_gain_m')
      protectionConflicts.push(conflict(preview.microcycleId, 'target_elevation_gain_m', 'manual_value'))
    }

    if (state?.protectObjective) {
      preservedFields.push('objective')
      protectionConflicts.push(conflict(preview.microcycleId, 'objective', 'protected_objective'))
    }

    const protectedSessionIds = (state?.protectedSessionIds ?? []).filter(Boolean)
    if (protectedSessionIds.length > 0) {
      preservedFields.push('session')
      protectionConflicts.push(conflict(
        preview.microcycleId,
        'session',
        'protected_session',
        protectedSessionIds,
      ))
    }

    return {
      ...preview,
      proposed: {
        ...preview.proposed,
        type,
        targetVolumeKm,
        targetElevationGainM,
      },
      preservedFields,
    } satisfies ProtectedCompetitionMicrocycleAdjustmentPreview
  })

  return {
    ...input.proposal,
    affectedMicrocycles,
    protectionConflicts,
    requiresCoachReview: input.proposal.requiresCoachReview || protectionConflicts.length > 0,
  }
}
