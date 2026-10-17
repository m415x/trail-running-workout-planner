import type postgres from 'postgres'

import type {
  ReviewPlanGenerationPreferencesFacts,
  ReviewPlanGenerationPreferencesScope,
} from './review-snapshot-plan-preferences-sqlite'

interface StoredPreferencesRow {
  readonly frequencyMode: string
  readonly fixedSessionsPerWeek: number | null
  readonly weeklyPattern: string
}

/**
 * PG-2: persisted Plan-scoped generation preferences, read exclusively in
 * the caller's SERIALIZABLE transaction. A successful empty result is a valid
 * absent preference; SQL failures MUST propagate, never imply defaults.
 *
 * Team/Group predicates establish SQL ownership evidence only; actor
 * authorization remains with the enclosing H2/H3/H4A boundary.
 */
export async function readReviewPlanGenerationPreferencesPostgres(
  tx: postgres.TransactionSql,
  scope: ReviewPlanGenerationPreferencesScope,
): Promise<ReviewPlanGenerationPreferencesFacts | null> {
  if (!scope.groupTrainingPlanId?.trim() ||
    !scope.teamId?.trim() || !scope.groupId?.trim()) return null

  const rows = await tx<StoredPreferencesRow[]>`
    SELECT prefs.frequency_mode AS "frequencyMode",
      prefs.fixed_sessions_per_week AS "fixedSessionsPerWeek",
      prefs.weekly_pattern AS "weeklyPattern"
    FROM session_generation_preferences AS prefs
    INNER JOIN group_training_plans AS plan
      ON plan.id = prefs.group_training_plan_id
      AND plan.is_deleted = false
    INNER JOIN athlete_groups AS athlete_group
      ON athlete_group.id = plan.group_id
      AND athlete_group.is_deleted = false
    INNER JOIN teams AS team
      ON team.id = athlete_group.team_id
      AND team.is_deleted = false
    WHERE plan.id = ${scope.groupTrainingPlanId}
      AND plan.group_id = ${scope.groupId}
      AND athlete_group.team_id = ${scope.teamId}
      AND prefs.is_deleted = false
    LIMIT 1
  `
  const stored = rows[0]
  if (!stored) return null

  if (stored.frequencyMode !== 'auto' && stored.frequencyMode !== 'fixed') {
    throw new Error('Invalid persisted generation preference frequency mode')
  }
  if (stored.fixedSessionsPerWeek !== null &&
    (!Number.isInteger(stored.fixedSessionsPerWeek) ||
      stored.fixedSessionsPerWeek < 1)) {
    throw new Error('Invalid persisted generation preference session frequency')
  }
  if (stored.frequencyMode === 'fixed' && stored.fixedSessionsPerWeek === null) {
    throw new Error('Invalid persisted generation preference: missing fixed frequency')
  }

  let pattern: unknown
  try {
    pattern = JSON.parse(stored.weeklyPattern)
  } catch {
    throw new Error('Invalid persisted generation preference pattern JSON')
  }
  if (!Array.isArray(pattern) || pattern.some(slot =>
    slot === null || Array.isArray(slot) || typeof slot !== 'object' ||
    typeof slot.weekday !== 'string' || !slot.weekday.trim() ||
    typeof slot.role !== 'string' || !slot.role.trim()
  )) {
    throw new Error('Invalid persisted generation preference pattern')
  }

  return {
    groupTrainingPlanId: scope.groupTrainingPlanId,
    teamId: scope.teamId,
    groupId: scope.groupId,
    frequencyMode: stored.frequencyMode,
    fixedSessionsPerWeek: stored.fixedSessionsPerWeek,
    weeklyPattern: pattern,
  }
}
