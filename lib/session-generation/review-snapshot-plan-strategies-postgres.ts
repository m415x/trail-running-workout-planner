import type postgres from 'postgres'

import type {
  ReviewPlanStrategyFacts,
  ReviewPlanStrategyScope,
} from './review-snapshot-plan-strategies-sqlite'

/**
 * Reads the persisted, Plan-scoped load and intensity inputs inside the
 * caller's existing SERIALIZABLE transaction. This provides SQL evidence,
 * not H2/H3/H4A actor authorization or a complete generation manifest.
 */
export async function readReviewPlanStrategyFactsPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewPlanStrategyScope,
): Promise<ReviewPlanStrategyFacts | null> {
  if (!scope.groupTrainingPlanId?.trim() ||
    !scope.teamId?.trim() || !scope.groupId?.trim()) {
    return null
  }

  const plan = await tx<{ id: string }[]>`
    SELECT p.id
    FROM group_training_plans AS p
    INNER JOIN athlete_groups AS g ON g.id = p.group_id
    INNER JOIN teams AS team ON team.id = g.team_id
    WHERE p.id = ${scope.groupTrainingPlanId}
      AND p.group_id = ${scope.groupId}
      AND g.team_id = ${scope.teamId}
      AND p.is_deleted = false
      AND g.is_deleted = false
      AND team.is_deleted = false
    LIMIT 1
  `
  if (!plan[0]) return null

  const loads = await tx<{
    maximumWeeklyVolumeKm: number
    initialWeeklyVolumeKm: number
  }[]>`
    SELECT maximum_weekly_volume_km AS "maximumWeeklyVolumeKm",
      initial_weekly_volume_km AS "initialWeeklyVolumeKm"
    FROM load_strategies
    WHERE group_training_plan_id = ${scope.groupTrainingPlanId}
      AND is_deleted = false
    LIMIT 1
  `

  const intensities = await tx<{
    defaultMethod: string
    maximumIntenseSessionsPerWeek: number
  }[]>`
    SELECT default_method AS "defaultMethod",
      maximum_intense_sessions_per_week AS "maximumIntenseSessionsPerWeek"
    FROM intensity_strategies
    WHERE group_training_plan_id = ${scope.groupTrainingPlanId}
      AND is_deleted = false
    LIMIT 1
  `

  const targets = await tx<{
    microcycleId: string
    intenseSessionsTarget: number
    predominantZone: string
    emphasis: string
    referencePercentageTarget: number | null
    minimumRecoveryDaysBetweenIntenseSessions: number
  }[]>`
    SELECT mi.id AS "microcycleId",
      target.intense_sessions_target AS "intenseSessionsTarget",
      target.predominant_zone AS "predominantZone",
      target.emphasis AS emphasis,
      target.reference_percentage_target AS "referencePercentageTarget",
      target.minimum_recovery_days_between_intense_sessions
        AS "minimumRecoveryDaysBetweenIntenseSessions"
    FROM microcycle_intensity_targets AS target
    INNER JOIN microcycles AS mi
      ON mi.id = target.microcycle_id AND mi.is_deleted = false
    INNER JOIN mesocycles AS me
      ON me.id = mi.mesocycle_id AND me.is_deleted = false
    INNER JOIN macrocycles AS ma
      ON ma.id = me.macrocycle_id AND ma.is_deleted = false
    WHERE ma.group_training_plan_id = ${scope.groupTrainingPlanId}
      AND target.is_deleted = false
    ORDER BY mi.id
  `

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    loadStrategy: loads[0] ?? null,
    intensityStrategy: intensities[0] ?? null,
    intensityTargets: Array.from(targets),
  }
}
