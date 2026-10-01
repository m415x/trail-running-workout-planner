import { resolveSessionMicrocycle, type SessionMicrocycleCandidate } from './session-microcycle-resolution'

export type SessionFormMicrocycleResolution = {
  status: 'resolved' | 'unavailable' | 'ambiguous'
  microcycleId: string
}

/**
 * Preserve explicitly selected planning scopes, including overlapping Base/Variant
 * microcycles of the same group. Legacy group selection remains unambiguous-only.
 */
export function reconcileSessionFormMicrocycles(
  sessionDate: string,
  selectedGroupIds: readonly string[],
  candidatesByGroup: Readonly<Record<string, readonly SessionMicrocycleCandidate[]>>,
  selectedMicrocyclesByGroup?: Readonly<Record<string, readonly string[]>>,
): Record<string, SessionFormMicrocycleResolution> {
  if (selectedMicrocyclesByGroup) {
    return Object.fromEntries(selectedGroupIds.flatMap((groupId) =>
      (selectedMicrocyclesByGroup[groupId] ?? []).map((microcycleId) => {
        const candidate = (candidatesByGroup[groupId] ?? []).find((item) => item.id === microcycleId)
        const valid = candidate && candidate.startDate <= sessionDate && sessionDate <= candidate.endDate
        return [microcycleId, {
          status: valid ? 'resolved' : 'unavailable',
          microcycleId: valid ? microcycleId : '',
        }] as const
      }),
    ))
  }

  return Object.fromEntries(selectedGroupIds.map((groupId) => {
    const resolution = resolveSessionMicrocycle(groupId, sessionDate, candidatesByGroup[groupId] ?? [])
    return [groupId, {
      status: resolution.status,
      microcycleId: resolution.status === 'resolved' ? resolution.microcycleId : '',
    }]
  }))
}
