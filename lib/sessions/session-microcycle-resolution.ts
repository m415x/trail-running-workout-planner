/** A date-bounded microcycle candidate already scoped to the requested group. */
export interface SessionMicrocycleCandidate {
  id: string
  startDate: string
  endDate: string
}

export type SessionMicrocycleResolution =
  | { status: 'resolved'; groupId: string; microcycleId: string }
  | { status: 'unavailable'; groupId: string }
  | { status: 'ambiguous'; groupId: string; microcycleIds: string[] }

/**
 * Resolves a group's microcycle for a session's calendar date.
 *
 * The caller must supply only valid candidates belonging to the given group.
 * Both interval endpoints are inclusive. Overlaps are reported rather than
 * resolved by query/input order; this function never invents a selection.
 */
export function resolveSessionMicrocycle(
  groupId: string,
  sessionDate: string,
  candidates: readonly SessionMicrocycleCandidate[],
): SessionMicrocycleResolution {
  const matchingIds = [...new Set(candidates
    .filter((candidate) => candidate.startDate <= sessionDate && sessionDate <= candidate.endDate)
    .map((candidate) => candidate.id))].sort()

  if (matchingIds.length === 0) return { status: 'unavailable', groupId }
  if (matchingIds.length === 1) {
    return { status: 'resolved', groupId, microcycleId: matchingIds[0] }
  }
  return { status: 'ambiguous', groupId, microcycleIds: matchingIds }
}
