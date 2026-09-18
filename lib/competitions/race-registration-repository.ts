import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { raceRegistrations } from '@/db/race-registration-schema'
import { athleteProfiles, users } from '@/db/schema'
import { getRaceCourseReference } from '@/lib/race-catalog/catalog-repository'
import {
  assertPersistableRaceRegistration,
  toRaceRegistrationPersistenceRecord,
} from '@/lib/competitions/race-registration-persistence'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

export type EditionRaceRegistration = RaceRegistrationPersistenceInput & { athleteName: string | null }

function mapRegistration(row: typeof raceRegistrations.$inferSelect): RaceRegistrationPersistenceInput {
  const hasResult = row.resultActualDistanceKm !== null || row.resultElapsedTimeSeconds !== null

  return {
    id: row.id,
    teamId: row.teamId,
    athleteProfileId: row.athleteProfileId,
    course: {
      raceEventId: row.raceEventId,
      raceEditionId: row.raceEditionId,
      raceCourseId: row.raceCourseId,
    },
    registrationStatus: row.registrationStatus,
    participationStatus: row.participationStatus,
    snapshot: {
      eventName: row.snapshotEventName,
      editionLabel: row.snapshotEditionLabel,
      editionDate: row.snapshotEditionDate,
      courseLabel: row.snapshotCourseLabel,
      nominalDistanceKm: row.snapshotNominalDistanceKm,
      nominalElevationGainM: row.snapshotNominalElevationGainM,
    },
    result: hasResult
      ? {
          actualDistanceKm: row.resultActualDistanceKm,
          elapsedTimeSeconds: row.resultElapsedTimeSeconds,
        }
      : null,
  }
}

export function getRaceRegistration(id: string): RaceRegistrationPersistenceInput | null {
  const row = db.select().from(raceRegistrations).where(eq(raceRegistrations.id, id)).get()
  return row ? mapRegistration(row) : null
}

export function getRaceRegistrationForTeam(input: {
  teamId: string
  registrationId: string
}): RaceRegistrationPersistenceInput | null {
  const row = db
    .select()
    .from(raceRegistrations)
    .where(and(
      eq(raceRegistrations.id, input.registrationId),
      eq(raceRegistrations.teamId, input.teamId),
    ))
    .get()

  return row ? mapRegistration(row) : null
}

export function listRaceRegistrationsForAthlete(input: {
  teamId: string
  athleteProfileId: string
}): RaceRegistrationPersistenceInput[] {
  return db
    .select()
    .from(raceRegistrations)
    .where(and(
      eq(raceRegistrations.teamId, input.teamId),
      eq(raceRegistrations.athleteProfileId, input.athleteProfileId),
    ))
    .all()
    .map(mapRegistration)
}

export function listRaceRegistrationsInEdition(input: {
  teamId: string
  raceEditionId: string
}): EditionRaceRegistration[] {
  const rows = db
    .select({
      registration: raceRegistrations,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(raceRegistrations)
    .leftJoin(athleteProfiles, eq(athleteProfiles.id, raceRegistrations.athleteProfileId))
    .leftJoin(users, eq(users.id, athleteProfiles.userId))
    .where(and(
      eq(raceRegistrations.teamId, input.teamId),
      eq(raceRegistrations.raceEditionId, input.raceEditionId),
    ))
    .all()

  return rows.map((row) => {
    const athleteName = [row.firstName, row.lastName].filter(Boolean).join(' ').trim()
    return {
      ...mapRegistration(row.registration),
      athleteName: athleteName || null,
    }
  })
}

export function findRaceRegistrationInEdition(input: {
  teamId: string
  athleteProfileId: string
  raceEditionId: string
}) {
  const row = db
    .select({
      registrationId: raceRegistrations.id,
      courseLabel: raceRegistrations.snapshotCourseLabel,
      registrationStatus: raceRegistrations.registrationStatus,
    })
    .from(raceRegistrations)
    .where(and(
      eq(raceRegistrations.teamId, input.teamId),
      eq(raceRegistrations.athleteProfileId, input.athleteProfileId),
      eq(raceRegistrations.raceEditionId, input.raceEditionId),
    ))
    .get()

  return row ?? null
}

export function createRaceRegistration(
  input: RaceRegistrationPersistenceInput,
): RaceRegistrationPersistenceInput {
  const resolvedCourse = getRaceCourseReference(input.course.raceCourseId)
  assertPersistableRaceRegistration(input, resolvedCourse)
  const record = toRaceRegistrationPersistenceRecord(input)
  const timestamp = new Date().toISOString()

  db.insert(raceRegistrations).values({
    id: record.id,
    teamId: record.teamId,
    athleteProfileId: record.athleteProfileId,
    raceEventId: record.raceEventId,
    raceEditionId: record.raceEditionId,
    raceCourseId: record.raceCourseId,
    registrationStatus: record.registrationStatus,
    participationStatus: record.participationStatus,
    snapshotEventName: record.snapshot.eventName,
    snapshotEditionLabel: record.snapshot.editionLabel,
    snapshotEditionDate: record.snapshot.editionDate,
    snapshotCourseLabel: record.snapshot.courseLabel,
    snapshotNominalDistanceKm: record.snapshot.nominalDistanceKm,
    snapshotNominalElevationGainM: record.snapshot.nominalElevationGainM,
    resultActualDistanceKm: record.result?.actualDistanceKm ?? null,
    resultElapsedTimeSeconds: record.result?.elapsedTimeSeconds ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run()

  return getRaceRegistration(input.id)!
}

export function updateRaceRegistration(
  input: RaceRegistrationPersistenceInput,
): RaceRegistrationPersistenceInput | null {
  const record = toRaceRegistrationPersistenceRecord(input)
  const timestamp = new Date().toISOString()

  db.update(raceRegistrations)
    .set({
      raceEventId: record.raceEventId,
      raceEditionId: record.raceEditionId,
      raceCourseId: record.raceCourseId,
      registrationStatus: record.registrationStatus,
      participationStatus: record.participationStatus,
      snapshotEventName: record.snapshot.eventName,
      snapshotEditionLabel: record.snapshot.editionLabel,
      snapshotEditionDate: record.snapshot.editionDate,
      snapshotCourseLabel: record.snapshot.courseLabel,
      snapshotNominalDistanceKm: record.snapshot.nominalDistanceKm,
      snapshotNominalElevationGainM: record.snapshot.nominalElevationGainM,
      resultActualDistanceKm: record.result?.actualDistanceKm ?? null,
      resultElapsedTimeSeconds: record.result?.elapsedTimeSeconds ?? null,
      updatedAt: timestamp,
    })
    .where(and(
      eq(raceRegistrations.id, input.id),
      eq(raceRegistrations.teamId, input.teamId),
    ))
    .run()

  const row = db
    .select()
    .from(raceRegistrations)
    .where(and(
      eq(raceRegistrations.id, input.id),
      eq(raceRegistrations.teamId, input.teamId),
    ))
    .get()

  return row ? mapRegistration(row) : null
}
