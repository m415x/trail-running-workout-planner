import { resolveSessionMicrocycle, type SessionMicrocycleCandidate } from './session-microcycle-resolution'

/**
 * Validates a selected microcycle against authoritative, group-scoped candidates.
 * Callers must load and scope candidates from persisted team/group/plan records.
 */
export function validateSessionMicrocycleDate(
  groupId: string,
  sessionDate: string,
  selectedMicrocycleId: string,
  candidates: readonly SessionMicrocycleCandidate[],
): { errorCode: 'microcycleDateMismatch' | 'microcycleDateAmbiguous'; errorParams: { group: string } } | null {
  const resolution = resolveSessionMicrocycle(groupId, sessionDate, candidates)
  if (resolution.status === 'ambiguous') {
    return { errorCode: 'microcycleDateAmbiguous', errorParams: { group: groupId } }
  }
  if (resolution.status === 'unavailable' || resolution.microcycleId !== selectedMicrocycleId) {
    return { errorCode: 'microcycleDateMismatch', errorParams: { group: groupId } }
  }
  return null
}
