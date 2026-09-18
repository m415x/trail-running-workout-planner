import type {
  RaceParticipationStatus,
  RaceRegistrationPersistenceInput,
} from '@/types/training/race-registration.types'

export interface AthleteRegistrationCandidate { athleteProfileId: string; athleteName: string }
export interface AthleteRaceRegistrationProjection { eventName: string; editionLabel: string; editionDate: string; courseLabel: string; nominalDistanceKm: number | null; nominalElevationGainM: number | null }
export interface AthleteRaceHistoryProjection extends AthleteRaceRegistrationProjection { participationStatus: RaceParticipationStatus; actualDistanceKm: number | null; elapsedTimeSeconds: number | null }
export interface AthleteRaceCompetitionProjection { upcomingRegistrations: AthleteRaceRegistrationProjection[]; history: AthleteRaceHistoryProjection[] }
export interface EditionRegistrationProjection { registrationId: string; athleteProfileId: string; athleteName: string | null; raceCourseId: string; registrationStatus: RaceRegistrationPersistenceInput['registrationStatus']; participationStatus: RaceParticipationStatus; actualDistanceKm: number | null; elapsedTimeSeconds: number | null }
export interface EditionCourseRegistrationsProjection { raceCourseId: string; courseLabel: string; nominalDistanceKm: number | null; nominalElevationGainM: number | null; registrations: EditionRegistrationProjection[] }
export interface CourseRegisteredAthlete extends AthleteRegistrationCandidate { courseLabel: string }
export interface CourseRegistrationEligibilityProjection { eligible: AthleteRegistrationCandidate[]; registeredHere: CourseRegisteredAthlete[]; registeredElsewhere: CourseRegisteredAthlete[] }
export interface BulkRaceRegistrationSuccess { athleteProfileId: string; registrationId: string }
export interface BulkRaceRegistrationFailure { athleteProfileId: string; reason: 'already_registered_in_edition'; existingCourseLabel: string }
export interface BulkRaceRegistrationResult { requested: number; succeeded: number; failed: number; registrations: BulkRaceRegistrationSuccess[]; failures: BulkRaceRegistrationFailure[] }
type EditionRegistrationInput = RaceRegistrationPersistenceInput & { athleteName?: string | null }

function projectSnapshot(registration: RaceRegistrationPersistenceInput): AthleteRaceRegistrationProjection {
  return { eventName: registration.snapshot.eventName, editionLabel: registration.snapshot.editionLabel, editionDate: registration.snapshot.editionDate, courseLabel: registration.snapshot.courseLabel, nominalDistanceKm: registration.snapshot.nominalDistanceKm, nominalElevationGainM: registration.snapshot.nominalElevationGainM }
}

export function projectAthleteRaceCompetition(registrations: readonly RaceRegistrationPersistenceInput[]): AthleteRaceCompetitionProjection {
  const effective = registrations.filter((registration) => registration.registrationStatus === 'registered')
  return {
    upcomingRegistrations: effective.filter((registration) => registration.participationStatus === 'unknown').map(projectSnapshot),
    history: effective.filter((registration) => registration.participationStatus !== 'unknown').map((registration) => ({ ...projectSnapshot(registration), participationStatus: registration.participationStatus, actualDistanceKm: registration.result?.actualDistanceKm ?? null, elapsedTimeSeconds: registration.result?.elapsedTimeSeconds ?? null })),
  }
}

export function projectRaceEditionRegistrations(
  registrations: readonly EditionRegistrationInput[],
  athletes: readonly AthleteRegistrationCandidate[] = [],
): EditionCourseRegistrationsProjection[] {
  const athleteNames = new Map(athletes.map((athlete) => [athlete.athleteProfileId, athlete.athleteName]))
  const groups = new Map<string, EditionCourseRegistrationsProjection>()
  for (const registration of registrations) {
    const raceCourseId = registration.course.raceCourseId
    let group = groups.get(raceCourseId)
    if (!group) {
      group = { raceCourseId, courseLabel: registration.snapshot.courseLabel, nominalDistanceKm: registration.snapshot.nominalDistanceKm, nominalElevationGainM: registration.snapshot.nominalElevationGainM, registrations: [] }
      groups.set(raceCourseId, group)
    }
    group.registrations.push({ registrationId: registration.id, athleteProfileId: registration.athleteProfileId, athleteName: registration.athleteName ?? athleteNames.get(registration.athleteProfileId) ?? null, raceCourseId, registrationStatus: registration.registrationStatus, participationStatus: registration.participationStatus, actualDistanceKm: registration.result?.actualDistanceKm ?? null, elapsedTimeSeconds: registration.result?.elapsedTimeSeconds ?? null })
  }
  return [...groups.values()]
}

export function projectCourseRegistrationEligibility(input: { athletes: readonly AthleteRegistrationCandidate[]; registrations: readonly RaceRegistrationPersistenceInput[]; raceEditionId: string; raceCourseId: string }): CourseRegistrationEligibilityProjection {
  const registrationsByAthlete = new Map(input.registrations.filter((registration) => registration.registrationStatus === 'registered' && registration.course.raceEditionId === input.raceEditionId).map((registration) => [registration.athleteProfileId, registration]))
  const result: CourseRegistrationEligibilityProjection = { eligible: [], registeredHere: [], registeredElsewhere: [] }
  for (const athlete of input.athletes) {
    const registration = registrationsByAthlete.get(athlete.athleteProfileId)
    if (!registration) { result.eligible.push(athlete); continue }
    const projected = { ...athlete, courseLabel: registration.snapshot.courseLabel }
    if (registration.course.raceCourseId === input.raceCourseId) result.registeredHere.push(projected)
    else result.registeredElsewhere.push(projected)
  }
  return result
}

export function summarizeBulkRaceRegistration(input: { requestedAthleteProfileIds: readonly string[]; registrations: BulkRaceRegistrationSuccess[]; failures: BulkRaceRegistrationFailure[] }): BulkRaceRegistrationResult {
  return { requested: input.requestedAthleteProfileIds.length, succeeded: input.registrations.length, failed: input.failures.length, registrations: input.registrations, failures: input.failures }
}
