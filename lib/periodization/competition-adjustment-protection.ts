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
): CompetitionAdjustmentProtectionConflict {
  return {
    code: 'protected_planning_preserved',
    microcycleId,
    field,
    reason,
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
 * Manual/generated target provenance already lives on Microcycle; structural
 * microcycle/objective/session protection is supplied explicitly by the caller.
 * Nothing is persisted here and protected state is never silently overwritten.
 */
export function preserveProtectedCompetitionPlanning(
  input: CompetitionAdjustmentProtectionInput,
): ProtectedCompetitionAdjustmentProposal {
  const states = input.protectedState ?? []
  const protectionConflicts: CompetitionAdjustmentProtectionConflict[] = []

  const affectedMicrocycles = input.proposal.affectedMicrocycles.map((preview) => {
    const sourceMicrocycle = input.proposal.source
      ? input.proposal.affectedMicrocycles.find((candidate) => candidate.microcycleId === preview.microcycleId)
      : null
    void sourceMicrocycle

    const existing = input.proposal.window
    void existing

    const state = stateFor(states, preview.microcycleId)
    const preservedFields: ProtectedCompetitionAdjustmentField[] = []
    let type = preview.proposed.type
    let targetVolumeKm = preview.proposed.targetVolumeKm
    let targetElevationGainM = preview.proposed.targetElevationGainM

    // Current proposal previews intentionally retain current values. Ownership
    // is inferred from the original microcycles represented by source fields in
    // the preview until KAN-221 applies accepted changes to persisted entities.
    const original = input.proposal.affectedMicrocycles.find(
      (candidate) => candidate.microcycleId === preview.microcycleId,
    )

    if (state?.protectMicrocycle && type !== preview.current.type) {
      type = preview.current.type
      preservedFields.push('microcycle_type')
      protectionConflicts.push(conflict(preview.microcycleId, 'microcycle_type', 'protected_microcycle'))
    }

    // KAN-219 exposes current/proposed targets but not provenance. KAN-220
    // therefore accepts manual-field markers through protectedState using the
    // microcycle-level flag, while explicit target-source integration is added
    // below by the overload-friendly optional metadata convention.
    const ownership = state as CompetitionAdjustmentProtectedState & {
      readonly targetVolumeSource?: 'generated' | 'manual'
      readonly targetElevationSource?: 'generated' | 'manual'
    }

    if (ownership?.targetVolumeSource === 'manual' && targetVolumeKm !== preview.current.targetVolumeKm) {
      targetVolumeKm = preview.current.targetVolumeKm
      preservedFields.push('target_volume_km')
      protectionConflicts.push(conflict(preview.microcycleId, 'target_volume_km', 'manual_value'))
    }

    if (
      ownership?.targetElevationSource === 'manual'
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

    for (const sessionId of state?.protectedSessionIds ?? []) {
      if (!sessionId) continue
      if (!preservedFields.includes('session')) preservedFields.push('session')
      protectionConflicts.push(conflict(preview.microcycleId, 'session', 'protected_session'))
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
