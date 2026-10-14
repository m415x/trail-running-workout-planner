import type Database from 'better-sqlite3'

/**
 * KAN-790/T5.3: read-only, Plan-scoped strategy source facts.
 * This is one partial source for generation; preferences, templates, and
 * competition calendar are not represented here.
 */
export interface ReviewPlanStrategyScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

interface LoadStrategyRow {
  readonly maximumWeeklyVolumeKm: number
  readonly initialWeeklyVolumeKm: number
}

interface IntensityStrategyRow {
  readonly defaultMethod: string
  readonly maximumIntenseSessionsPerWeek: number
}

interface IntensityTargetRow {
  readonly microcycleId: string
  readonly intenseSessionsTarget: number
  readonly predominantZone: string
}

export interface ReviewPlanStrategyFacts extends ReviewPlanStrategyScope {
  readonly loadStrategy: LoadStrategyRow | null
  readonly intensityStrategy: IntensityStrategyRow | null
  readonly intensityTargets: readonly IntensityTargetRow[]
}

/** Never infer access from an ID alone; the caller must also authorize H2/H3/H4A. */
export function readReviewPlanStrategyFactsSqlite(
  sqlite: Database.Database,
  scope: ReviewPlanStrategyScope,
): ReviewPlanStrategyFacts | null {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim()) {
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

  const loadStrategy = sqlite.prepare(`
    SELECT maximum_weekly_volume_km AS maximumWeeklyVolumeKm,
           initial_weekly_volume_km AS initialWeeklyVolumeKm
    FROM load_strategies
    WHERE group_training_plan_id = ? AND is_deleted = 0
  `).get(scope.groupTrainingPlanId) as LoadStrategyRow | undefined

  const intensityStrategy = sqlite.prepare(`
    SELECT default_method AS defaultMethod,
           maximum_intense_sessions_per_week AS maximumIntenseSessionsPerWeek
    FROM intensity_strategies
    WHERE group_training_plan_id = ? AND is_deleted = 0
  `).get(scope.groupTrainingPlanId) as IntensityStrategyRow | undefined

  const intensityTargets = sqlite.prepare(`
    SELECT mi.id AS microcycleId,
           t.intense_sessions_target AS intenseSessionsTarget,
           t.predominant_zone AS predominantZone
    FROM microcycle_intensity_targets AS t
    INNER JOIN microcycles AS mi ON mi.id = t.microcycle_id AND mi.is_deleted = 0
    INNER JOIN mesocycles AS me ON me.id = mi.mesocycle_id AND me.is_deleted = 0
    INNER JOIN macrocycles AS ma ON ma.id = me.macrocycle_id AND ma.is_deleted = 0
    WHERE ma.group_training_plan_id = ? AND t.is_deleted = 0
    ORDER BY mi.id
  `).all(scope.groupTrainingPlanId) as IntensityTargetRow[]

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    loadStrategy: loadStrategy ?? null,
    intensityStrategy: intensityStrategy ?? null,
    intensityTargets,
  }
}
