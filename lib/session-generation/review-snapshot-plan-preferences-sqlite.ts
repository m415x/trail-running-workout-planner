import type Database from 'better-sqlite3'

/**
 * KAN-790/T5.3 — persisted session-generation preferences source only.
 * The generator's resolved defaults are a separate, server-owned input;
 * absence of a stored preference is not equivalent to an empty pattern.
 */
export interface ReviewPlanGenerationPreferencesScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

interface StoredPreferencesRow {
  readonly frequencyMode: string
  readonly fixedSessionsPerWeek: number | null
  readonly weeklyPattern: string
}

export interface ReviewPlanGenerationPreferencesFacts extends ReviewPlanGenerationPreferencesScope {
  readonly frequencyMode: 'auto' | 'fixed'
  readonly fixedSessionsPerWeek: number | null
  readonly weeklyPattern: readonly {
    readonly weekday: string
    readonly role: string
  }[]
}

/** Reads the current persisted row; authorization of the actor remains external. */
export function readReviewPlanGenerationPreferencesSqlite(
  sqlite: Database.Database,
  scope: ReviewPlanGenerationPreferencesScope,
): ReviewPlanGenerationPreferencesFacts | null {
  if (!scope.groupTrainingPlanId?.trim() || !scope.teamId?.trim() || !scope.groupId?.trim()) {
    return null
  }

  const stored = sqlite.prepare(`
    SELECT prefs.frequency_mode AS frequencyMode,
           prefs.fixed_sessions_per_week AS fixedSessionsPerWeek,
           prefs.weekly_pattern AS weeklyPattern
    FROM session_generation_preferences AS prefs
    INNER JOIN group_training_plans AS p
      ON p.id = prefs.group_training_plan_id AND p.is_deleted = 0
    INNER JOIN athlete_groups AS g
      ON g.id = p.group_id AND g.is_deleted = 0
    WHERE p.id = ? AND p.group_id = ? AND g.team_id = ?
      AND prefs.is_deleted = 0
  `).get(scope.groupTrainingPlanId, scope.groupId, scope.teamId) as StoredPreferencesRow | undefined

  if (!stored) return null
  if (stored.frequencyMode !== 'auto' && stored.frequencyMode !== 'fixed') {
    throw new Error('Invalid persisted generation preference frequency mode')
  }
  if (stored.fixedSessionsPerWeek !== null &&
    (!Number.isInteger(stored.fixedSessionsPerWeek) || stored.fixedSessionsPerWeek < 1)) {
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
    groupId: scope.groupId,
    teamId: scope.teamId,
    frequencyMode: stored.frequencyMode,
    fixedSessionsPerWeek: stored.fixedSessionsPerWeek,
    weeklyPattern: pattern,
  }
}
