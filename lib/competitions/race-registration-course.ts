import type {
  RaceCourse,
  RaceCourseReference,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'
import type {
  RaceRegistrationCourseState,
  RaceRegistrationSnapshot,
} from '@/types/training/race-registration.types'

export function createRaceRegistrationSnapshot(
  event: RaceEvent,
  edition: RaceEdition,
  course: RaceCourse,
): RaceRegistrationSnapshot {
  return {
    eventName: event.name,
    editionLabel: edition.label,
    editionDate: edition.startDate,
    courseLabel: course.label,
    nominalDistanceKm: course.distanceKm,
    nominalElevationGainM: course.elevationGainM,
  }
}

/**
 * Changes the selected course only while no participation fact is known.
 * The returned value contains the new reference and its matching snapshot,
 * making them one domain result for later atomic persistence.
 */
export function changeRaceRegistrationCourse(
  current: RaceRegistrationCourseState,
  event: RaceEvent,
  edition: RaceEdition,
  course: RaceCourse,
): RaceRegistrationCourseState {
  if (current.participationStatus !== 'unknown') {
    throw new Error('Ordinary course changes are blocked once participation evidence exists')
  }

  if (edition.id !== current.course.raceEditionId || course.raceEditionId !== edition.id) {
    throw new Error('Course change cannot target a different race edition')
  }

  if (edition.raceEventId !== event.id) {
    throw new Error('Race edition does not belong to the supplied event')
  }

  const reference: RaceCourseReference = {
    raceEventId: event.id,
    raceEditionId: edition.id,
    raceCourseId: course.id,
  }

  return {
    course: reference,
    snapshot: createRaceRegistrationSnapshot(event, edition, course),
    participationStatus: current.participationStatus,
  }
}
