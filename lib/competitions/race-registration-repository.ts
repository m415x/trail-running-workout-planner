import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { raceRegistrations } from '@/db/race-registration-schema'
import { getRaceCourseReference } from '@/lib/race-catalog/catalog-repository'
import {
  assertPersistableRaceRegistration,
  toRaceRegistrationPersistenceRecord,
} from '@/lib/competitions/race-registration-persistence'
import type { RaceRegistrationPersistenceInput } from '@/types/training/race-registration.types'

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
