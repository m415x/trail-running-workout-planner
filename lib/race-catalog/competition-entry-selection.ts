import type {
  CompetitionEntryDraft,
  CompetitionPriority,
  CompetitionStatus,
} from '@/types/training/competition-entry.types'
import type {
  RaceCourse,
  RaceCourseClassification,
  RaceCourseModality,
  RaceCourseReference,
  RaceEdition,
  RaceEvent,
} from '@/types/training/race-catalog.types'

export interface RaceCoursePlanningSnapshot {
  readonly raceEventName: string
  readonly raceEditionLabel: string
  readonly raceCourseLabel: string
  readonly date: string
  readonly distanceKm: number
  readonly elevationGainM: number | null
  readonly modality: RaceCourseModality | null
  readonly classifications: readonly RaceCourseClassification[]
}

export interface RaceCourseCompetitionSelection {
  readonly reference: RaceCourseReference
  readonly snapshot: RaceCoursePlanningSnapshot
  readonly competitionDraft: CompetitionEntryDraft
}

export interface SelectRaceCourseForCompetitionInput {
  readonly event: RaceEvent
  readonly edition: RaceEdition
  readonly course: RaceCourse
  readonly groupTrainingPlanId: string
  readonly priority: CompetitionPriority
  readonly status?: CompetitionStatus
  readonly description?: string | null
}

export type RaceCourseCompetitionSelectionErrorCode =
  | 'race_catalog_ancestry_mismatch'
  | 'race_catalog_event_unavailable'
  | 'race_catalog_edition_unavailable'
  | 'race_catalog_course_unavailable'
  | 'race_catalog_course_distance_unknown'

export type RaceCourseCompetitionSelectionResult =
  | {
      readonly valid: true
      readonly selection: RaceCourseCompetitionSelection
    }
  | {
      readonly valid: false
      readonly errors: readonly RaceCourseCompetitionSelectionErrorCode[]
    }

function cloneModality(modality: RaceCourseModality | null): RaceCourseModality | null {
  if (modality === null) return null
  return modality.code === 'other'
    ? { code: 'other', label: modality.label }
    : { code: modality.code }
}

function cloneClassifications(
  classifications: readonly RaceCourseClassification[],
): RaceCourseClassification[] {
  return classifications.map((classification) => ({ ...classification }))
}

/**
 * Creates an immutable planning snapshot from one published catalog course.
 *
 * The returned CompetitionEntry draft copies sporting values; it never keeps a
 * live dependency on the catalog. Persistence of the optional catalog reference
 * is deliberately handled later by the KAN-276 schema boundary.
 */
export function selectRaceCourseForCompetition(
  input: SelectRaceCourseForCompetitionInput,
): RaceCourseCompetitionSelectionResult {
  const errors: RaceCourseCompetitionSelectionErrorCode[] = []

  if (
    input.edition.raceEventId !== input.event.id
    || input.course.raceEditionId !== input.edition.id
  ) {
    errors.push('race_catalog_ancestry_mismatch')
  }

  if (input.event.status !== 'active' || input.event.isDeleted) {
    errors.push('race_catalog_event_unavailable')
  }
  if (input.edition.status !== 'published' || input.edition.isDeleted) {
    errors.push('race_catalog_edition_unavailable')
  }
  if (input.course.status !== 'published' || input.course.isDeleted) {
    errors.push('race_catalog_course_unavailable')
  }
  if (input.course.distanceKm === null) {
    errors.push('race_catalog_course_distance_unknown')
  }

  if (errors.length > 0 || input.course.distanceKm === null) {
    return { valid: false, errors: [...new Set(errors)] }
  }

  const date = input.course.scheduledStartAt?.slice(0, 10) ?? input.edition.startDate
  const classifications = cloneClassifications(input.course.classifications)
  const modality = cloneModality(input.course.modality)
  const name = `${input.event.name} — ${input.course.label}`

  return {
    valid: true,
    selection: {
      reference: {
        raceEventId: input.event.id,
        raceEditionId: input.edition.id,
        raceCourseId: input.course.id,
      },
      snapshot: {
        raceEventName: input.event.name,
        raceEditionLabel: input.edition.label,
        raceCourseLabel: input.course.label,
        date,
        distanceKm: input.course.distanceKm,
        elevationGainM: input.course.elevationGainM,
        modality,
        classifications,
      },
      competitionDraft: {
        groupTrainingPlanId: input.groupTrainingPlanId,
        name,
        date,
        distanceKm: input.course.distanceKm,
        elevationGainM: input.course.elevationGainM,
        priority: input.priority,
        status: input.status ?? 'planned',
        description: input.description ?? null,
      },
    },
  }
}
