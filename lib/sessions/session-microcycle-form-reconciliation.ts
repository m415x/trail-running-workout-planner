import { resolveSessionMicrocycle, type SessionMicrocycleCandidate } from './session-microcycle-resolution'

export type SessionFormMicrocycleResolution = {
  status: 'resolved' | 'unavailable' | 'ambiguous'
  microcycleId: string
}

/** Reconcile only selected groups; never retain a stale or ambiguous microcycle. */
export function reconcileSessionFormMicrocycles(
  sessionDate: string,
  selectedGroupIds: readonly string[],
  candidatesByGroup: Readonly<Record<string, readonly SessionMicrocycleCandidate[]>>,
): Record<string, SessionFormMicrocycleResolution> {
  return Object.fromEntries(selectedGroupIds.map((groupId) => {
    const resolution = resolveSessionMicrocycle(groupId, sessionDate, candidatesByGroup[groupId] ?? [])
    return [groupId, {
      status: resolution.status,
      microcycleId: resolution.status === 'resolved' ? resolution.microcycleId : '',
    }]
  }))
}
