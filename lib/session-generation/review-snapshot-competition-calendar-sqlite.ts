import type Database from 'better-sqlite3'

/**
 * KAN-790/T5.3 — persisted competition calendar facts for exactly one Plan.
 * Preserve all non-deleted lifecycle states; planning-active filtering and
 * primary-candidate selection remain the domain layer's responsibility.
 */
export interface ReviewPlanCompetitionCalendarScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

export interface ReviewCompetitionCalendarEntryFacts {
  readonly id: string
  readonly name: string
  readonly date: string
  readonly distanceKm: number
  readonly elevationGainM: number | null
  readonly priority: string
  readonly status: string
  readonly description: string | null
}

export interface ReviewPlanCompetitionCalendarFacts extends ReviewPlanCompetitionCalendarScope {
  readonly competitions: readonly ReviewCompetitionCalendarEntryFacts[]
}

/**
 * Team/Group are SQL predicates rather than trust in a client-supplied Plan ID.
 * The server caller must still perform actor-level H2/H3/H4A authorization.
 * This read is independent of sibling Base/Variant calendars and makes no writes.
 */
export function readReviewPlanCompetitionCalendarFactsSqlite(
  sqlite: Database.Database,
  scope: ReviewPlanCompetitionCalendarScope,
): ReviewPlanCompetitionCalendarFacts | null {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim()) {
    return null
  }

  const plan = sqlite.prepare(`
    SELECT p.id
    FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    WHERE p.id = ? AND p.group_id = ? AND g.team_id = ?
      AND p.is_deleted = 0 AND g.is_deleted = 0
  `).get(scope.groupTrainingPlanId, scope.groupId, scope.teamId)
  if (!plan) return null

  const competitions = sqlite.prepare(`
    SELECT id, name, date,
           distance_km AS distanceKm,
           elevation_gain_m AS elevationGainM,
           priority, status, description
    FROM competition_entries
    WHERE group_training_plan_id = ? AND is_deleted = 0
    ORDER BY date, name, id
  `).all(scope.groupTrainingPlanId) as ReviewCompetitionCalendarEntryFacts[]

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    competitions,
  }
}
