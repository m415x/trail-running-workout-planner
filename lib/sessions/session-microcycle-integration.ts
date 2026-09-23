import { validateSessionMicrocycleDate } from './session-microcycle-boundary'
import type { SessionMicrocycleCandidate } from './session-microcycle-resolution'

export interface SessionMicrocyclePrescriptionReference {
  groupId: string
  microcycleId: string
}

/**
 * Validate every group of a shared session before any create/edit write.
 * Candidates must already be scoped to the persisted team, group and active plan.
 */
export function validateSessionMicrocyclePrescriptions(
  sessionDate: string,
  prescriptions: readonly SessionMicrocyclePrescriptionReference[],
  candidatesByGroup: Readonly<Record<string, readonly SessionMicrocycleCandidate[]>>,
) {
  for (const prescription of prescriptions) {
    const error = validateSessionMicrocycleDate(
      prescription.groupId,
      sessionDate,
      prescription.microcycleId,
      candidatesByGroup[prescription.groupId] ?? [],
    )
    if (error) return error
  }
  return null
}
