import type { SessionMicrocycleCandidate } from './session-microcycle-resolution'

/**
 * Validates the explicitly selected microcycle against group-scoped candidates.
 * Callers must load and scope candidates from persisted team/group/plan records.
 * Another valid microcycle on the same date does not invalidate this selection.
 */
export function validateSessionMicrocycleDate(
  groupId: string,
  sessionDate: string,
  selectedMicrocycleId: string,
  candidates: readonly SessionMicrocycleCandidate[],
): { errorCode: 'microcycleDateMismatch'; errorParams: { group: string } } | null {
  const selected = candidates.find((candidate) => candidate.id === selectedMicrocycleId)
  if (!selected || sessionDate < selected.startDate || sessionDate > selected.endDate) {
    return { errorCode: 'microcycleDateMismatch', errorParams: { group: groupId } }
  }
  return null
}
