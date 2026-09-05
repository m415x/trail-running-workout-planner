import type {
  MicrocycleIntensityTargetDraft,
  MicrocycleIntensityTargetField,
  MicrocycleIntensityTargetFieldSources,
} from '@/types'

export interface ReconcileIntensityTargetParams {
  generatedTarget: MicrocycleIntensityTargetDraft
  existingTarget: MicrocycleIntensityTargetDraft
  restoreGeneratedFields?: MicrocycleIntensityTargetField[]
}

export interface ReconciledIntensityTarget {
  target: MicrocycleIntensityTargetDraft
  preservedManualFields: MicrocycleIntensityTargetField[]
  restoredGeneratedFields: MicrocycleIntensityTargetField[]
}

const EDITABLE_FIELDS: readonly MicrocycleIntensityTargetField[] = [
  'intenseSessionsTarget',
  'predominantZone',
  'pamPercentageTarget',
  'minimumRecoveryDaysBetweenIntenseSessions',
]

/**
 * Reconciles a newly generated weekly target with an existing coach-edited one.
 *
 * Generated values follow the new proposal. Manual fields remain untouched,
 * including an explicit `null` PAM override, unless the caller requests that
 * specific field to return to its generated value.
 */
export function reconcileMicrocycleIntensityTarget({
  generatedTarget,
  existingTarget,
  restoreGeneratedFields = [],
}: ReconcileIntensityTargetParams): ReconciledIntensityTarget {
  const fieldsToRestore = new Set(restoreGeneratedFields)
  const shouldPreserve = (field: MicrocycleIntensityTargetField) =>
    existingTarget.fieldSources[field] === 'manual' && !fieldsToRestore.has(field)
  const preservedManualFields = EDITABLE_FIELDS.filter(shouldPreserve)
  const restoredGeneratedFields = EDITABLE_FIELDS.filter(
    (field) => existingTarget.fieldSources[field] === 'manual' && fieldsToRestore.has(field),
  )
  const fieldSources = Object.fromEntries(
    EDITABLE_FIELDS.map((field) => [field, shouldPreserve(field) ? 'manual' : 'generated']),
  ) as MicrocycleIntensityTargetFieldSources

  return {
    target: {
      ...generatedTarget,
      intenseSessionsTarget: shouldPreserve('intenseSessionsTarget')
        ? existingTarget.intenseSessionsTarget
        : generatedTarget.intenseSessionsTarget,
      predominantZone: shouldPreserve('predominantZone')
        ? existingTarget.predominantZone
        : generatedTarget.predominantZone,
      pamPercentageTarget: shouldPreserve('pamPercentageTarget')
        ? existingTarget.pamPercentageTarget
        : generatedTarget.pamPercentageTarget,
      minimumRecoveryDaysBetweenIntenseSessions: shouldPreserve(
        'minimumRecoveryDaysBetweenIntenseSessions',
      )
        ? existingTarget.minimumRecoveryDaysBetweenIntenseSessions
        : generatedTarget.minimumRecoveryDaysBetweenIntenseSessions,
      fieldSources,
    },
    preservedManualFields,
    restoredGeneratedFields,
  }
}
