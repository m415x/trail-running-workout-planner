import type {
  RaceParticipationStatus,
  RaceResult,
} from '@/types/training/race-registration.types'

/**
 * Preserves supplied competitive facts exactly. In particular, null remains
 * unknown and numeric zero remains known; no nominal course data is consulted.
 */
export function createRaceResult(result: RaceResult): RaceResult {
  return {
    actualDistanceKm: result.actualDistanceKm,
    elapsedTimeSeconds: result.elapsedTimeSeconds,
  }
}

/**
 * Associates factual result metrics only with participation states that may
 * carry athlete result evidence in the MVP. DNS/unknown never fabricate a result.
 */
export function raceResultForParticipation(
  participationStatus: RaceParticipationStatus,
  result: RaceResult,
): RaceResult | null {
  if (participationStatus !== 'finished' && participationStatus !== 'dnf') return null

  return createRaceResult(result)
}
