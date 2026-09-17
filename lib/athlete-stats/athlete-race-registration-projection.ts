import type {
  RaceParticipationStatus,
  RaceRegistrationPersistenceInput,
} from '@/types/training/race-registration.types'

export interface AthleteRaceRegistrationItem {
  readonly registrationId: string
  readonly raceCourseId: string
  readonly eventName: string
  readonly editionLabel: string
  readonly editionDate: string
  readonly courseLabel: string
  readonly nominalDistanceKm: number | null
  readonly nominalElevationGainM: number | null
  readonly participationStatus: RaceParticipationStatus
  readonly actualDistanceKm: number | null
  readonly elapsedTimeSeconds: number | null
}

export interface AthleteRaceRegistrationsProjection {
  readonly upcoming: readonly AthleteRaceRegistrationItem[]
  readonly history: readonly AthleteRaceRegistrationItem[]
}

function item(registration: RaceRegistrationPersistenceInput): AthleteRaceRegistrationItem {
  return {
    registrationId: registration.id,
    raceCourseId: registration.course.raceCourseId,
    eventName: registration.snapshot.eventName,
    editionLabel: registration.snapshot.editionLabel,
    editionDate: registration.snapshot.editionDate,
    courseLabel: registration.snapshot.courseLabel,
    nominalDistanceKm: registration.snapshot.nominalDistanceKm,
    nominalElevationGainM: registration.snapshot.nominalElevationGainM,
    participationStatus: registration.participationStatus,
    actualDistanceKm: registration.result?.actualDistanceKm ?? null,
    elapsedTimeSeconds: registration.result?.elapsedTimeSeconds ?? null,
  }
}

export function projectAthleteRaceRegistrations(
  registrations: readonly RaceRegistrationPersistenceInput[],
  today: string,
): AthleteRaceRegistrationsProjection {
  const effective = registrations.filter(
    (registration) => registration.registrationStatus === 'registered',
  )

  return {
    upcoming: effective
      .filter((registration) => registration.snapshot.editionDate >= today)
      .map(item),
    history: effective
      .filter((registration) => registration.snapshot.editionDate < today)
      .map(item),
  }
}
