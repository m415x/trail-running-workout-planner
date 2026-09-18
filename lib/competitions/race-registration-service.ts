import {
  summarizeBulkRaceRegistration,
  type BulkRaceRegistrationFailure,
  type BulkRaceRegistrationSuccess,
} from '@/lib/competitions/race-registration-application'
import { recordRaceParticipation, correctRaceParticipation, type RaceParticipationEvidence } from '@/lib/competitions/race-participation'
import { changeRaceRegistrationCourse, createRaceRegistrationSnapshot } from '@/lib/competitions/race-registration-course'
import { raceResultForParticipation } from '@/lib/competitions/race-result'
import type { RaceCourse, RaceEdition, RaceEvent } from '@/types/training/race-catalog.types'
import type {
  RaceParticipationStatus,
  RaceRegistrationPersistenceInput,
  RaceRegistrationStatus,
  RaceResult,
} from '@/types/training/race-registration.types'

interface RaceRegistrationTarget {
  event: RaceEvent
  edition: RaceEdition
  course: RaceCourse
}

interface BulkRegistrationInput {
  teamId: string
  athleteProfileIds: readonly string[]
  target: RaceRegistrationTarget
}

type CreateRegistrationResult =
  | { ok: true; registrationId: string }
  | {
      ok: false
      reason: 'already_registered_in_edition'
      existingCourseLabel: string
    }

interface BulkRegistrationDependencies {
  createId: (athleteProfileId: string) => string
  createRegistration: (
    input: RaceRegistrationPersistenceInput,
  ) => Promise<CreateRegistrationResult> | CreateRegistrationResult
}

interface UpdateRaceParticipationInput {
  teamId: string
  registrationId: string
  participationStatus: RaceParticipationStatus
  actualDistanceKm: number | null
  elapsedTimeSeconds: number | null
}

export interface UpdateRaceParticipationDependencies {
  getRegistration: (input: {
    teamId: string
    registrationId: string
  }) => Promise<RaceRegistrationPersistenceInput | null> | RaceRegistrationPersistenceInput | null
  updateRegistration: (
    input: RaceRegistrationPersistenceInput,
  ) => Promise<RaceRegistrationPersistenceInput | null> | RaceRegistrationPersistenceInput | null
}

export async function bulkRegisterAthletes(
  input: BulkRegistrationInput,
  dependencies: BulkRegistrationDependencies,
) {
  const registrations: BulkRaceRegistrationSuccess[] = []
  const failures: BulkRaceRegistrationFailure[] = []

  for (const athleteProfileId of input.athleteProfileIds) {
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

    const created = await dependencies.createRegistration(registration)
    if (created.ok) {
      registrations.push({ athleteProfileId, registrationId: created.registrationId })
    } else {
      failures.push({
        athleteProfileId,
        reason: created.reason,
        existingCourseLabel: created.existingCourseLabel,
      })
    }
  }

  return summarizeBulkRaceRegistration({
    requestedAthleteProfileIds: input.athleteProfileIds,
    registrations,
    failures,
  })
}

export function applyRaceRegistrationCourseChange(
  registration: RaceRegistrationPersistenceInput,
  target: RaceRegistrationTarget,
): RaceRegistrationPersistenceInput {
  const changed = changeRaceRegistrationCourse(
    {
      course: registration.course,
      snapshot: registration.snapshot,
      participationStatus: registration.participationStatus,
    },
    target.event,
    target.edition,
    target.course,
  )

  return {
    ...registration,
    course: changed.course,
    snapshot: changed.snapshot,
  }
}

export function applyRaceRegistrationLifecycle(
  registration: RaceRegistrationPersistenceInput,
  registrationStatus: RaceRegistrationStatus,
): RaceRegistrationPersistenceInput {
  return { ...registration, registrationStatus }
}

export function applyRaceParticipationEvidence(
  registration: RaceRegistrationPersistenceInput,
  evidence: RaceParticipationEvidence,
  result: RaceResult,
): RaceRegistrationPersistenceInput {
  const participationStatus = recordRaceParticipation(registration.participationStatus, evidence)

  return {
    ...registration,
    participationStatus,
    result: raceResultForParticipation(participationStatus, result),
  }
}

export function applyRaceParticipationCorrection(
  registration: RaceRegistrationPersistenceInput,
  corrected: RaceParticipationStatus,
  result: RaceResult,
): RaceRegistrationPersistenceInput {
  const participationStatus = correctRaceParticipation(registration.participationStatus, corrected)

  return {
    ...registration,
    participationStatus,
    result: raceResultForParticipation(participationStatus, result),
  }
}

export async function updateRaceParticipation(
  input: UpdateRaceParticipationInput,
  dependencies: UpdateRaceParticipationDependencies,
): Promise<
  | { ok: true; registration: RaceRegistrationPersistenceInput }
  | { ok: false; reason: 'not_found' }
> {
  const registration = await dependencies.getRegistration({
    teamId: input.teamId,
    registrationId: input.registrationId,
  })

  if (!registration) return { ok: false, reason: 'not_found' }

  const corrected = applyRaceParticipationCorrection(
    registration,
    input.participationStatus,
    {
      actualDistanceKm: input.actualDistanceKm,
      elapsedTimeSeconds: input.elapsedTimeSeconds,
    },
  )
  const persisted = await dependencies.updateRegistration(corrected)

  if (!persisted) return { ok: false, reason: 'not_found' }
  return { ok: true, registration: persisted }
}
