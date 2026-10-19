import type Database from 'better-sqlite3'

import {
  readReviewPlanPeriodizationFactsSqlite,
  type ReviewPlanPeriodizationFacts,
} from './review-snapshot-plan-periodization-sqlite'
import {
  readReviewPlanStrategyFactsSqlite,
  type ReviewPlanStrategyFacts,
} from './review-snapshot-plan-strategies-sqlite'
import {
  readReviewPlanGenerationPreferencesSqlite,
  type ReviewPlanGenerationPreferencesFacts,
} from './review-snapshot-plan-preferences-sqlite'
import {
  readReviewWorkoutTemplateFactsSqlite,
  type ReviewWorkoutTemplateCatalogueFacts,
} from './review-snapshot-workout-templates-sqlite'
import {
  readReviewPlanCompetitionCalendarFactsSqlite,
  type ReviewPlanCompetitionCalendarFacts,
} from './review-snapshot-competition-calendar-sqlite'

export interface ReviewSnapshotSqlSourceScope {
  readonly groupTrainingPlanId: string
  readonly teamId: string
  readonly groupId: string
}

/**
 * Persisted SQL facts only. Do not confuse this with the effective
 * SessionGenerationInput manifest: domain projections, resolved defaults and
 * generator input transformation have not yet been reconciled.
 */
export interface ReviewSnapshotSqlSourceEvidence extends ReviewSnapshotSqlSourceScope {
  readonly periodization: ReviewPlanPeriodizationFacts
  readonly strategies: ReviewPlanStrategyFacts
  readonly preferences: ReviewPlanGenerationPreferencesFacts | null
  readonly templates: ReviewWorkoutTemplateCatalogueFacts
  readonly calendar: ReviewPlanCompetitionCalendarFacts
}

/**
 * Uses one SQLite read transaction so the five constituent reads see a
 * consistent database version, rather than mixing generations of rows if
 * another connection commits between queries. This function never writes.
 * H2/H3/H4A actor authorization is still the caller's responsibility.
 */
export function readReviewSnapshotSqlSourceEvidence(
  sqlite: Database.Database,
  scope: ReviewSnapshotSqlSourceScope,
): ReviewSnapshotSqlSourceEvidence | null {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim()) {
    return null
  }

  return sqlite.transaction(() => {
    const periodization = readReviewPlanPeriodizationFactsSqlite(sqlite, scope)
    if (!periodization) return null

    const strategies = readReviewPlanStrategyFactsSqlite(sqlite, scope)
    if (!strategies) return null

    // No stored preferences is distinct from an empty pattern; resolving
    // server-owned defaults belongs to a later generation-input adapter.
    const preferences = readReviewPlanGenerationPreferencesSqlite(sqlite, scope)

    const templates = readReviewWorkoutTemplateFactsSqlite(sqlite, scope)
    if (!templates) return null

    const calendar = readReviewPlanCompetitionCalendarFactsSqlite(sqlite, scope)
    if (!calendar) return null

    return {
      groupTrainingPlanId: scope.groupTrainingPlanId,
      teamId: scope.teamId,
      groupId: scope.groupId,
      periodization,
      strategies,
      preferences,
      templates,
      calendar,
    }
  }).deferred()
}
