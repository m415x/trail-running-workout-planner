import { and, eq, count } from 'drizzle-orm'
import { athleteProfiles } from '@/db/schema'
import type { db } from '@/db'

/** A single aggregate, not the full administrative athlete list. */
export function createCoachHomeActiveAthleteCountQuery(database: typeof db) {
  return async (teamId: string): Promise<number> => {
    const rows = await database.select({ total: count() })
      .from(athleteProfiles)
      .where(and(
        eq(athleteProfiles.teamId, teamId),
        eq(athleteProfiles.isActive, true),
        eq(athleteProfiles.isDeleted, false),
      ))
    return Number(rows[0]?.total ?? 0)
  }
}
