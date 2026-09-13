import type { RaceCourseOriginalProfile } from '@/types/training/race-catalog.types'

export type RaceCourseProfileValidationErrorCode =
  | 'race_course_distance_invalid'
  | 'race_course_elevation_gain_invalid'

export type RaceCourseProfileValidationResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseProfileValidationErrorCode[]
    }

/**
 * Validates only the original editable course measurements.
 *
 * Missing values stay unknown (`null`). Publication requirements and
 * cross-field/modal coherence belong to later race-catalog policies.
 */
export function validateRaceCourseOriginalProfile(
  profile: RaceCourseOriginalProfile,
): RaceCourseProfileValidationResult {
  const errors: RaceCourseProfileValidationErrorCode[] = []

  if (
    profile.distanceKm !== null &&
    (!Number.isFinite(profile.distanceKm) || profile.distanceKm <= 0)
  ) {
    errors.push('race_course_distance_invalid')
  }

  if (
    profile.elevationGainM !== null &&
    (!Number.isFinite(profile.elevationGainM) || profile.elevationGainM < 0)
  ) {
    errors.push('race_course_elevation_gain_invalid')
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}
