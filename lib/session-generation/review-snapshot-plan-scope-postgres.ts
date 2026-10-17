import type postgres from 'postgres'

interface ReviewSnapshotPlanScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

interface ResolvedReviewSnapshotPlanScope extends ReviewSnapshotPlanScope {
  readonly planningCohortId: string | null
  readonly sourceGroupTrainingPlanId: string | null
}

/**
 * PG-2: inspect persisted Plan ownership and Base/Variant lineage using the
 * caller's SERIALIZABLE TransactionSql. This is SQL scope evidence, NOT
 * H2/H3/H4A actor authorization; the confirmation boundary must enforce those.
 *
 * The caller MUST keep using the same transaction for source freshness, CAS,
 * reconciliation and audit. Do not open a pool-level connection here.
 */
export async function readReviewSnapshotPlanScopePostgres(
  tx: postgres.TransactionSql,
  scope: ReviewSnapshotPlanScope,
): Promise<ResolvedReviewSnapshotPlanScope | null> {
  if (!scope.groupTrainingPlanId?.trim() || !scope.teamId?.trim() ||
    !scope.groupId?.trim()) return null

  const rows = await tx<{
    groupTrainingPlanId: string
    teamId: string
    groupId: string
    planningCohortId: string | null
    sourceGroupTrainingPlanId: string | null
  }[]>`
    SELECT
      plan.id AS "groupTrainingPlanId",
      athlete_group.team_id AS "teamId",
      athlete_group.id AS "groupId",
      plan.planning_cohort_id AS "planningCohortId",
      plan.source_group_training_plan_id AS "sourceGroupTrainingPlanId"
    FROM group_training_plans AS plan
    INNER JOIN athlete_groups AS athlete_group
      ON athlete_group.id = plan.group_id
    INNER JOIN teams AS team
      ON team.id = athlete_group.team_id
    LEFT JOIN planning_cohorts AS cohort
      ON cohort.id = plan.planning_cohort_id
    LEFT JOIN group_training_plans AS base_plan
      ON base_plan.id = plan.source_group_training_plan_id
    WHERE plan.id = ${scope.groupTrainingPlanId}
      AND plan.group_id = ${scope.groupId}
      AND athlete_group.team_id = ${scope.teamId}
      AND plan.is_deleted = false
      AND athlete_group.is_deleted = false
      AND team.is_deleted = false
      AND (
        (
          plan.planning_cohort_id IS NULL
          AND plan.source_group_training_plan_id IS NULL
        ) OR (
          cohort.id IS NOT NULL
          AND cohort.is_deleted = false
          AND cohort.status = 'active'
          AND cohort.team_id = athlete_group.team_id
          AND cohort.group_id = athlete_group.id
          AND base_plan.id IS NOT NULL
          AND base_plan.is_deleted = false
          AND base_plan.group_id = athlete_group.id
          AND base_plan.planning_cohort_id IS NULL
          AND base_plan.source_group_training_plan_id IS NULL
        )
      )
    LIMIT 1
  `
  const row = rows[0]
  return row ? {
    groupTrainingPlanId: row.groupTrainingPlanId,
    teamId: row.teamId,
    groupId: row.groupId,
    planningCohortId: row.planningCohortId,
    sourceGroupTrainingPlanId: row.sourceGroupTrainingPlanId,
  } : null
}
