import type {
  RaceCourse,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'

export type RaceCourseSelectionErrorCode =
  | 'race_catalog_ancestry_mismatch'
  | 'race_catalog_event_unavailable'
  | 'race_catalog_edition_unavailable'
  | 'race_catalog_course_unavailable'
  | 'race_catalog_course_distance_unknown'

export type RaceCourseSelectionPolicyResult =
  | { readonly valid: true }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseSelectionErrorCode[]
    }

/**
 * Shared policy for selecting one live catalog course into another domain.
 *
 * Historical consumers do not use this policy to invalidate already accepted
 * snapshots after a catalog entity is archived/cancelled.
 */
export function validateRaceCourseSelection(
  event: RaceEvent,
  edition: RaceEdition,
  course: RaceCourse,
): RaceCourseSelectionPolicyResult {
  const errors: RaceCourseSelectionErrorCode[] = []

  if (
    edition.raceEventId !== event.id
    || course.raceEditionId !== edition.id
  ) {
    errors.push('race_catalog_ancestry_mismatch')
  }

  if (event.status !== 'active' || event.isDeleted) {
    errors.push('race_catalog_event_unavailable')
  }
  if (edition.status !== 'published' || edition.isDeleted) {
    errors.push('race_catalog_edition_unavailable')
  }
  if (course.status !== 'published' || course.isDeleted) {
    errors.push('race_catalog_course_unavailable')
  }
  if (course.distanceKm === null) {
    errors.push('race_catalog_course_distance_unknown')
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors: [...new Set(errors)] }
}
