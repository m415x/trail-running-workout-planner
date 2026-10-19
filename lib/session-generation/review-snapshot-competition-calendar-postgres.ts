import type postgres from 'postgres'

import type {
  ReviewCompetitionCalendarEntryFacts,
  ReviewPlanCompetitionCalendarFacts,
  ReviewPlanCompetitionCalendarScope,
} from './review-snapshot-competition-calendar-sqlite'

/**
 * KAN-790/T5.4 PG-2 — persisted calendar facts for one Team-scoped Plan.
 * Uses only the caller-owned TransactionSql; the caller owns SERIALIZABLE
 * isolation and H2/H3/H4A authorization. SQL errors propagate unchanged.
 *
 * Preserve every non-deleted competition status, including cancelled:
 * the domain projection applies its own planning-active filtering.
 */
export async function readReviewPlanCompetitionCalendarFactsPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewPlanCompetitionCalendarScope,
): Promise<ReviewPlanCompetitionCalendarFacts | null> {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim()) {
    return null
  }

  const plans = await tx<{ id: string }[]>`
    SELECT p.id
    FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    INNER JOIN teams AS t ON t.id = g.team_id
    WHERE p.id = ${scope.groupTrainingPlanId}
      AND p.group_id = ${scope.groupId}
      AND g.team_id = ${scope.teamId}
      AND p.is_deleted = false
      AND g.is_deleted = false
      AND t.is_deleted = false
    LIMIT 1
  `
  if (!plans[0]) return null

  const competitions = await tx<ReviewCompetitionCalendarEntryFacts[]>`
    SELECT id, name, date,
      distance_km AS "distanceKm",
      elevation_gain_m AS "elevationGainM",
      priority, status, description
    FROM competition_entries
    WHERE group_training_plan_id = ${scope.groupTrainingPlanId}
      AND is_deleted = false
    ORDER BY date, name, id
  `

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    competitions: Array.from(competitions),
  }
}
