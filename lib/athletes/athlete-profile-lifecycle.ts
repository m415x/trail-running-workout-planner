import { and, eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { athleteProfiles } from '@/db/schema'

export interface SetAthleteProfileActiveStateInput {
  teamId: string
  athleteId: string
  isActive: boolean
  updatedAt: string
}

export function setAthleteProfileActiveState<TSchema extends Record<string, unknown>>(
  database: BetterSQLite3Database<TSchema>,
  input: SetAthleteProfileActiveStateInput,
): void {
  const athlete = database
    .select({ id: athleteProfiles.id })
    .from(athleteProfiles)
    .where(
      and(
        eq(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
        eq(athleteProfiles.isDeleted, false),
      ),
    )
    .get()

  if (!athlete) {
    throw new Error('Athlete not found')
  }

  database
    .update(athleteProfiles)
    .set({
      isActive: input.isActive,
      updatedAt: input.updatedAt,
    })
    .where(
      and(
        eq(athleteProfiles.id, input.athleteId),
        eq(athleteProfiles.teamId, input.teamId),
      ),
    )
    .run()
}
