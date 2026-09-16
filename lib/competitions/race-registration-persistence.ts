import type { RaceCourseReference } from '@/types/training/race-catalog.types'
import type {
  RaceRegistrationPersistenceInput,
  RaceRegistrationSnapshot,
  RaceRegistrationStatus,
  RaceParticipationStatus,
  RaceResult,
} from '@/types/training/race-registration.types'

export interface RaceRegistrationPersistenceRecord {
  id: string
  teamId: string
  athleteProfileId: string
  raceEventId: string
  raceEditionId: string
  raceCourseId: string
  registrationStatus: RaceRegistrationStatus
  participationStatus: RaceParticipationStatus
  snapshot: RaceRegistrationSnapshot
  result: RaceResult | null
}

/** Persistence uniqueness mirrors the domain identity and deliberately excludes course. */
export function raceRegistrationPersistenceKey(input: RaceRegistrationPersistenceInput): string {
  return JSON.stringify([input.teamId, input.athleteProfileId, input.course.raceEditionId])
}

/**
 * Verifies that the concrete catalog hierarchy resolved for the selected course
 * is exactly the hierarchy carried by the registration.
 */
export function assertPersistableRaceRegistration(
  input: RaceRegistrationPersistenceInput,
  resolvedCourse: RaceCourseReference | null,
): void {
  if (
    !resolvedCourse
    || resolvedCourse.raceEventId !== input.course.raceEventId
    || resolvedCourse.raceEditionId !== input.course.raceEditionId
    || resolvedCourse.raceCourseId !== input.course.raceCourseId
  ) {
    throw new Error('Race registration course does not match catalog hierarchy')
  }
}

/** Flattens relational identity while preserving snapshot/result facts verbatim. */
export function toRaceRegistrationPersistenceRecord(
  input: RaceRegistrationPersistenceInput,
): RaceRegistrationPersistenceRecord {
  return {
    id: input.id,
    teamId: input.teamId,
    athleteProfileId: input.athleteProfileId,
    raceEventId: input.course.raceEventId,
    raceEditionId: input.course.raceEditionId,
    raceCourseId: input.course.raceCourseId,
    registrationStatus: input.registrationStatus,
    participationStatus: input.participationStatus,
    snapshot: input.snapshot,
    result: input.result,
  }
}
