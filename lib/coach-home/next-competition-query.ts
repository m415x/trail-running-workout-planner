import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import { competitionEntries } from '@/db/competition-entry-schema'
import type { db } from '@/db'

/**
 * Single SQL query for the earliest future competition across a server-authorized
 * set of Plans. It does not use the global RaceCatalog or per-Plan calendar reads.
 */
export function createCoachHomeNextCompetitionQuery(database: typeof db) {
  return async (authorizedPlanIds: readonly string[], today: string) => {
    if (authorizedPlanIds.length === 0) return []
    return database.select({
      id: competitionEntries.id,
      groupTrainingPlanId: competitionEntries.groupTrainingPlanId,
      name: competitionEntries.name,
      date: competitionEntries.date,
      status: competitionEntries.status,
      priority: competitionEntries.priority,
      distanceKm: competitionEntries.distanceKm,
      isDeleted: competitionEntries.isDeleted,
    }).from(competitionEntries).where(and(
      inArray(competitionEntries.groupTrainingPlanId, [...new Set(authorizedPlanIds)]),
      eq(competitionEntries.isDeleted, false),
      gte(competitionEntries.date, today),
      inArray(competitionEntries.status, ['planned', 'confirmed']),
    )).orderBy(asc(competitionEntries.date), asc(competitionEntries.id)).limit(1)
  }
}
