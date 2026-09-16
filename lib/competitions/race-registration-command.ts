import { createRaceRegistrationSnapshot } from '@/lib/competitions/race-registration-course'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

type ExistingRegistration = {
  registrationId: string
  courseLabel: string
}

type RegistrationLookup = {
  teamId: string
  athleteProfileId: string
  raceEditionId: string
}

type Target = {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
}

type Dependencies = {
  findEffectiveRegistrationInEdition: (
    input: RegistrationLookup,
  ) => Promise<ExistingRegistration | null> | ExistingRegistration | null
  persistRegistration: (
    input: RaceRegistrationPersistenceInput,
  ) => Promise<RaceRegistrationPersistenceInput> | RaceRegistrationPersistenceInput
  findRegistrationInEdition?: (
    input: RegistrationLookup,
  ) => Promise<ExistingRegistration | null> | ExistingRegistration | null
  createId: (athleteProfileId: string) => string
}

function isUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) return false
  const code = (error as Error & { code?: string }).code
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505'
}

export async function executeBulkRaceRegistration(
  input: {
    teamId: string
    athleteProfileIds: readonly string[]
    target: Target
  },
  dependencies: Dependencies,
) {
  const registrations: Array<{ athleteProfileId: string; registrationId: string }> = []
  const failures: Array<{
    athleteProfileId: string
    reason: 'already_registered_in_edition'
    existingCourseLabel: string
  }> = []

  for (const athleteProfileId of input.athleteProfileIds) {
    const lookup = {
      teamId: input.teamId,
      athleteProfileId,
      raceEditionId: input.target.edition.id,
    }
    const existing = await dependencies.findEffectiveRegistrationInEdition(lookup)

    if (existing) {
      failures.push({
        athleteProfileId,
        reason: 'already_registered_in_edition',
        existingCourseLabel: existing.courseLabel,
      })
      continue
    }

    const registration: RaceRegistrationPersistenceInput = {
      id: dependencies.createId(athleteProfileId),
      teamId: input.teamId,
      athleteProfileId,
      course: {
        raceEventId: input.target.event.id,
        raceEditionId: input.target.edition.id,
        raceCourseId: input.target.course.id,
      },
      registrationStatus: 'registered',
      participationStatus: 'unknown',
      snapshot: createRaceRegistrationSnapshot(
        input.target.event,
        input.target.edition,
        input.target.course,
      ),
      result: null,
    }

    try {
      const persisted = await dependencies.persistRegistration(registration)
      registrations.push({ athleteProfileId, registrationId: persisted.id })
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error

      const concurrent = dependencies.findRegistrationInEdition
        ? await dependencies.findRegistrationInEdition(lookup)
        : null
      if (!concurrent) throw error

      failures.push({
        athleteProfileId,
        reason: 'already_registered_in_edition',
        existingCourseLabel: concurrent.courseLabel,
      })
    }
  }

  return {
    requested: input.athleteProfileIds.length,
    succeeded: registrations.length,
    failed: failures.length,
    registrations,
    failures,
  }
}
