import type postgres from 'postgres'

import type {
  ReviewPlanPeriodizationFacts,
  ReviewPlanPeriodizationScope,
  ReviewPeriodizationMicrocycleFacts,
} from './review-snapshot-plan-periodization-sqlite'

interface PeriodizationRow extends Omit<ReviewPeriodizationMicrocycleFacts,
  'id' | 'macrocycleId' | 'mesocycleId'> {
  microcycleId: string
  macrocycleId: string
  mesocycleId: string
}

/**
 * PG-2 periodization facts use the caller's existing SERIALIZABLE transaction,
 * not an independent connection or a freshly started read transaction.
 *
 * This is server-sourced planning evidence only. H2/H3/H4A authority remains
 * the responsibility of the enclosing confirmation boundary.
 */
export async function readReviewPlanPeriodizationFactsPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewPlanPeriodizationScope,
): Promise<ReviewPlanPeriodizationFacts | null> {
  if (!scope.groupTrainingPlanId?.trim() ||
    !scope.teamId?.trim() || !scope.groupId?.trim()) {
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

  const rows = await tx<PeriodizationRow[]>`
    SELECT
      mi.id AS "microcycleId",
      ma.id AS "macrocycleId",
      ma.end_date AS "macrocycleEndDate",
      ma.target_race_name AS "macrocycleTargetRaceName",
      ma.target_race_distance_km AS "macrocycleTargetRaceDistanceKm",
      ma.target_race_elevation_gain AS "macrocycleTargetRaceElevationGain",
      me.id AS "mesocycleId",
      me.period AS period,
      mi.week_number AS "weekNumber",
      mi.type AS type,
      mi.start_date AS "startDate",
      mi.end_date AS "endDate",
      mi.target_volume_km AS "targetVolumeKm",
      mi.target_elevation_gain AS "targetElevationGain",
      mi.target_duration_min AS "targetDurationMin"
    FROM group_training_plans AS p
    INNER JOIN macrocycles AS ma
      ON ma.group_training_plan_id = p.id AND ma.is_deleted = false
    INNER JOIN mesocycles AS me
      ON me.macrocycle_id = ma.id AND me.is_deleted = false
    INNER JOIN microcycles AS mi
      ON mi.mesocycle_id = me.id AND mi.is_deleted = false
    WHERE p.id = ${scope.groupTrainingPlanId}
      AND p.is_deleted = false
    ORDER BY ma.start_date, ma.id, mi.start_date, mi.week_number, mi.id
  `

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    microcycles: rows.map(row => ({
      id: row.microcycleId,
      macrocycleId: row.macrocycleId,
      macrocycleEndDate: row.macrocycleEndDate,
      macrocycleTargetRaceName: row.macrocycleTargetRaceName,
      macrocycleTargetRaceDistanceKm: row.macrocycleTargetRaceDistanceKm,
      macrocycleTargetRaceElevationGain: row.macrocycleTargetRaceElevationGain,
      mesocycleId: row.mesocycleId,
      period: row.period,
      weekNumber: row.weekNumber,
      type: row.type,
      startDate: row.startDate,
      endDate: row.endDate,
      targetVolumeKm: row.targetVolumeKm,
      targetElevationGain: row.targetElevationGain,
      targetDurationMin: row.targetDurationMin,
    })),
  }
}
