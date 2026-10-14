import {
  resolveSessionGenerationPreferences,
  type ResolvedSessionGenerationPreferences,
  type StoredSessionGenerationPreferences,
} from './generation-preferences-persistence'
import type { ReviewPlanGenerationPreferencesFacts } from './review-snapshot-plan-preferences-sqlite'

/**
 * Reuses the actual domain resolution applied to Coach generation inputs.
 * An absent SQL preference row takes the same server-owned default path.
 *
 * Call only with facts read from an already scoped SQL source. This pure
 * projection is not an H2/H3/H4A authorization or SQL freshness boundary.
 */
export function projectReviewSqlGenerationPreferences(
  stored: ReviewPlanGenerationPreferencesFacts | null,
): ResolvedSessionGenerationPreferences {
  if (stored === null) {
    return resolveSessionGenerationPreferences(null)
  }

  // Validate the discriminant at runtime too: persisted data is untrusted even
  // when the caller's TypeScript type narrows to the two supported modes.
  if (stored.frequencyMode !== 'auto' && stored.frequencyMode !== 'fixed') {
    throw new Error('Invalid persisted generation preference frequency mode')
  }

  // The existing domain resolver validates weekday, role, slot cardinality,
  // duplicates and frequency semantics. Do not reproduce its rules here.
  const weeklyPattern = stored.weeklyPattern.map(({ weekday, role }) => ({
    weekday,
    role,
  })) as StoredSessionGenerationPreferences['weeklyPattern']

  return resolveSessionGenerationPreferences({
    frequencyMode: stored.frequencyMode,
    fixedSessionsPerWeek: stored.fixedSessionsPerWeek,
    weeklyPattern,
  })
}
