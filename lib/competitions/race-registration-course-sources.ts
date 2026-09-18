import { and, eq, ne } from 'drizzle-orm'

import { db } from '@/db'
import { raceRegistrations } from '@/db/race-registration-schema'
import { athleteProfiles, users } from '@/db/schema'

export async function listActiveCourseRegistrationAthletes(teamId: string) {
  const rows = await db
    .select({
      athleteProfileId: athleteProfiles.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(athleteProfiles)
    .innerJoin(users, eq(users.id, athleteProfiles.userId))
    .where(and(
      eq(athleteProfiles.teamId, teamId),
      eq(athleteProfiles.isDeleted, false),
      eq(athleteProfiles.isActive, true),
    ))

  return rows.map((row) => ({
    athleteProfileId: row.athleteProfileId,
    athleteName: `${row.firstName} ${row.lastName}`.trim(),
  }))
}

export async function listEffectiveCourseRegistrationsInEdition(input: {
  teamId: string
  raceEditionId: string
}) {
  return db
    .select({
      registrationId: raceRegistrations.id,
      athleteProfileId: raceRegistrations.athleteProfileId,
      raceCourseId: raceRegistrations.raceCourseId,
      courseLabel: raceRegistrations.snapshotCourseLabel,
    })
    .from(raceRegistrations)
    .where(and(
      eq(raceRegistrations.teamId, input.teamId),
      eq(raceRegistrations.raceEditionId, input.raceEditionId),
      ne(raceRegistrations.registrationStatus, 'cancelled'),
    ))
}
