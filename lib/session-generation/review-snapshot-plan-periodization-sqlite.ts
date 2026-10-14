import type Database from 'better-sqlite3'

/**
 * T5.3 partial server source: persisted Plan periodization facts only.
 * Preferences, training strategies, templates and competition calendar must
 * also be sourced before this can become an authoritative generation manifest.
 */
export interface ReviewPlanPeriodizationScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

export interface ReviewPeriodizationMicrocycleFacts {
  readonly id: string
  readonly macrocycleId: string
  readonly mesocycleId: string
  readonly period: string
  readonly weekNumber: number
  readonly type: string
  readonly startDate: string
  readonly endDate: string
  readonly targetVolumeKm: number | null
  readonly targetElevationGain: number | null
  readonly targetDurationMin: number | null
}

export interface ReviewPlanPeriodizationFacts extends ReviewPlanPeriodizationScope {
  readonly microcycles: readonly ReviewPeriodizationMicrocycleFacts[]
}

interface PeriodizationRow {
  microcycleId: string
  macrocycleId: string
  mesocycleId: string
  period: string
  weekNumber: number
  type: string
  startDate: string
  endDate: string
  targetVolumeKm: number | null
  targetElevationGain: number | null
  targetDurationMin: number | null
}

/**
 * Reads only currently visible, non-deleted microcycle ancestry for a
 * separately authorized Plan/Team/Group scope. SQL predicates—not caller-
 * supplied rows—enforce ownership. No mutation or cache is involved.
 */
export function readReviewPlanPeriodizationFactsSqlite(
  sqlite: Database.Database,
  scope: ReviewPlanPeriodizationScope,
): ReviewPlanPeriodizationFacts | null {
  if (!scope.groupTrainingPlanId?.trim() || !scope.teamId?.trim() || !scope.groupId?.trim()) {
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

  const rows = sqlite.prepare(`
    SELECT
      mi.id AS microcycleId,
      ma.id AS macrocycleId,
      me.id AS mesocycleId,
      me.period AS period,
      mi.week_number AS weekNumber,
      mi.type AS type,
      mi.start_date AS startDate,
      mi.end_date AS endDate,
      mi.target_volume_km AS targetVolumeKm,
      mi.target_elevation_gain AS targetElevationGain,
      mi.target_duration_min AS targetDurationMin
    FROM group_training_plans AS p
    INNER JOIN macrocycles AS ma
      ON ma.group_training_plan_id = p.id AND ma.is_deleted = 0
    INNER JOIN mesocycles AS me
      ON me.macrocycle_id = ma.id AND me.is_deleted = 0
    INNER JOIN microcycles AS mi
      ON mi.mesocycle_id = me.id AND mi.is_deleted = 0
    WHERE p.id = ? AND p.is_deleted = 0
    ORDER BY ma.start_date, ma.id, mi.start_date, mi.week_number, mi.id
  `).all(scope.groupTrainingPlanId) as PeriodizationRow[]

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    microcycles: rows.map(row => ({
      id: row.microcycleId,
      macrocycleId: row.macrocycleId,
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
