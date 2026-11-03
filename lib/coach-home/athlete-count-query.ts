import { and, eq, count } from 'drizzle-orm'
import { athleteProfiles } from '@/db/schema'

/** A single aggregate, not the full administrative athlete list. */
export function createCoachHomeActiveAthleteCountQuery(database: {
  select: (selection: { total: ReturnType<typeof count> }) => any
}) {
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
