import type { RaceCourseOriginalProfile } from '@/types/training/race-catalog.types'

export interface RaceCourseDerivedProfile {
  /** Positive elevation gain normalized by course distance, in m+/km. */
  readonly elevationDensityMPerKm: number | null
  /** Kilometer-effort descriptor: distanceKm + elevationGainM / 100. */
  readonly kilometerEffortKm: number | null
}

/**
 * Calculates the shared kilometer-effort convention from known measurements.
 *
 * This is a descriptive course-demand signal, not a training-load or readiness
 * formula. Unknown D+ remains unknown rather than being treated as a flat course.
 */
export function calculateKilometerEffortKm(
  distanceKm: number,
  elevationGainM: number | null,
): number | null {
  if (elevationGainM === null) return null
  return distanceKm + elevationGainM / 100
}

/**
 * Derives reproducible course descriptors from original catalog measurements.
 *
 * Both derived values require known distance and D+. The function deliberately
 * performs no rounding so storage/presentation can choose precision explicitly.
 */
export function deriveRaceCourseProfile(
  profile: RaceCourseOriginalProfile,
): RaceCourseDerivedProfile {
  if (profile.distanceKm === null || profile.elevationGainM === null) {
    return {
      elevationDensityMPerKm: null,
      kilometerEffortKm: null,
    }
  }

  return {
    elevationDensityMPerKm: profile.elevationGainM / profile.distanceKm,
    kilometerEffortKm: calculateKilometerEffortKm(
      profile.distanceKm,
      profile.elevationGainM,
    ),
  }
}
