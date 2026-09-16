import type { RaceParticipationStatus } from '@/types/training/race-registration.types'

export type RaceParticipationEvidence = Exclude<RaceParticipationStatus, 'unknown'>

/**
 * Records new factual participation evidence without silently replacing an
 * already-known fact. `null` means no new evidence and therefore preserves the
 * current state.
 */
export function recordRaceParticipation(
  current: RaceParticipationStatus,
  evidence: RaceParticipationEvidence | null,
): RaceParticipationStatus {
  if (evidence === null) return current

  if (current === 'unknown') return evidence
  if (current === 'started' && (evidence === 'finished' || evidence === 'dnf')) return evidence
  if (current === evidence) return current

  throw new Error('Existing participation evidence requires explicit correction')
}

/**
 * Replaces a known participation fact through an explicit factual-correction
 * operation. This deliberately carries no audit/event-sourcing semantics.
 */
export function correctRaceParticipation(
  _current: RaceParticipationStatus,
  corrected: RaceParticipationStatus,
): RaceParticipationStatus {
  return corrected
}
