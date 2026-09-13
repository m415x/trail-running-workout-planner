import { validateRaceCourseSelection } from '@/lib/race-catalog/race-course-selection-policy'
import type { RaceCourseSelectionErrorCode } from '@/lib/race-catalog/race-course-selection-policy'
import type {
  RaceCourse,
  RaceCourseReference,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'

/** Snapshot fields already owned by the athlete TrainingGoal model. */
export interface RaceCourseTrainingGoalPatch {
  readonly targetDate: string
  readonly raceName: string
  readonly raceDistanceKm: number
  readonly raceElevationGain: number | null
}

/**
 * Catalog context carried alongside a goal selection until KAN-276 persists the
 * optional RaceCourse reference. This is not an athlete race registration.
 */
export interface RaceCourseTrainingGoalSelection {
  readonly reference: RaceCourseReference
  readonly goalPatch: RaceCourseTrainingGoalPatch
}

export interface SelectRaceCourseForTrainingGoalInput {
  readonly event: RaceEvent
  readonly edition: RaceEdition
  readonly course: RaceCourse
}

export type RaceCourseTrainingGoalSelectionResult =
  | {
      readonly valid: true
      readonly selection: RaceCourseTrainingGoalSelection
    }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseSelectionErrorCode[]
    }

/**
 * Copies one selectable catalog course into athlete-owned TrainingGoal fields.
 *
 * The returned goal snapshot is independent from the catalog after selection.
 * Selecting a course here does not create or imply RaceRegistration.
 */
export function selectRaceCourseForTrainingGoal(
  input: SelectRaceCourseForTrainingGoalInput,
): RaceCourseTrainingGoalSelectionResult {
  const selectionPolicy = validateRaceCourseSelection(
    input.event,
    input.edition,
    input.course,
  )
  if (!selectionPolicy.valid) return selectionPolicy

  const distanceKm = input.course.distanceKm
  if (distanceKm === null) {
    return { valid: false, errors: ['race_catalog_course_distance_unknown'] }
  }

  const targetDate = input.course.scheduledStartAt?.slice(0, 10) ?? input.edition.startDate

  return {
    valid: true,
    selection: {
      reference: {
        raceEventId: input.event.id,
        raceEditionId: input.edition.id,
        raceCourseId: input.course.id,
      },
      goalPatch: {
        targetDate,
        raceName: `${input.event.name} — ${input.course.label}`,
        raceDistanceKm: distanceKm,
        raceElevationGain: input.course.elevationGainM,
      },
    },
  }
}
