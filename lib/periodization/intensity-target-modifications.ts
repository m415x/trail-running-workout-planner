import type {
  MicrocycleIntensityTargetDraft,
  MicrocycleIntensityTargetField,
  MicrocycleIntensityTargetFieldSources,
} from '@/types'

type EditableIntensityTargetValues = Pick<
  MicrocycleIntensityTargetDraft,
  MicrocycleIntensityTargetField
>

export interface MicrocycleIntensityTargetModification {
  field: MicrocycleIntensityTargetField
  previousValue: EditableIntensityTargetValues[MicrocycleIntensityTargetField]
  newValue: EditableIntensityTargetValues[MicrocycleIntensityTargetField]
}

const EDITABLE_FIELDS: readonly MicrocycleIntensityTargetField[] = [
  'intenseSessionsTarget',
  'predominantZone',
  'pamPercentageTarget',
  'minimumRecoveryDaysBetweenIntenseSessions',
]

function areEqual(
  left: EditableIntensityTargetValues[MicrocycleIntensityTargetField],
  right: EditableIntensityTargetValues[MicrocycleIntensityTargetField],
): boolean {
  return left === right
}

/** Derives per-field provenance by comparing effective and generated values. */
export function deriveMicrocycleIntensityTargetFieldSources(
  generatedTarget: MicrocycleIntensityTargetDraft,
  effectiveTarget: MicrocycleIntensityTargetDraft,
): MicrocycleIntensityTargetFieldSources {
  return Object.fromEntries(
    EDITABLE_FIELDS.map((field) => [
      field,
      areEqual(generatedTarget[field], effectiveTarget[field]) ? 'generated' : 'manual',
    ]),
  ) as MicrocycleIntensityTargetFieldSources
}

/** Lists only deliberate coach changes relative to the generated proposal. */
export function getMicrocycleIntensityTargetModifications(
  generatedTarget: MicrocycleIntensityTargetDraft,
  effectiveTarget: MicrocycleIntensityTargetDraft,
): MicrocycleIntensityTargetModification[] {
  return EDITABLE_FIELDS.flatMap((field) => {
    const previousValue = generatedTarget[field]
    const newValue = effectiveTarget[field]

    return areEqual(previousValue, newValue)
      ? []
      : [{ field, previousValue, newValue }]
  })
}

/**
 * Applies a partial coach override while preserving untouched generated values.
 * Returning a value to its generated recommendation also restores its source.
 */
export function applyManualMicrocycleIntensityChanges(
  generatedTarget: MicrocycleIntensityTargetDraft,
  changes: Partial<EditableIntensityTargetValues>,
): MicrocycleIntensityTargetDraft {
  const effectiveTarget: MicrocycleIntensityTargetDraft = {
    ...generatedTarget,
    ...changes,
    fieldSources: { ...generatedTarget.fieldSources },
  }

  return {
    ...effectiveTarget,
    fieldSources: deriveMicrocycleIntensityTargetFieldSources(
      generatedTarget,
      effectiveTarget,
    ),
  }
}
