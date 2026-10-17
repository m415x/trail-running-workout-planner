import type postgres from 'postgres'

import { readReviewPlanPeriodizationFactsPostgres } from './review-snapshot-plan-periodization-postgres'
import { readReviewPlanStrategyFactsPostgres } from './review-snapshot-plan-strategies-postgres'
import { readReviewPlanGenerationPreferencesPostgres } from './review-snapshot-plan-preferences-postgres'
import { readReviewWorkoutTemplateFactsPostgres } from './review-snapshot-workout-templates-postgres'
import { readReviewPlanCompetitionCalendarFactsPostgres } from './review-snapshot-competition-calendar-postgres'
import type {
  ReviewSnapshotSqlSourceEvidence,
  ReviewSnapshotSqlSourceScope,
} from './review-snapshot-sql-source-evidence'

/**
 * Re-reads all five persisted, scoped generation sources through precisely
 * the caller-owned PostgreSQL transaction. Caller must establish SERIALIZABLE
 * isolation before the first read, and authorize H2/H3/H4A separately.
 *
 * A missing/deleted/mismatched Plan is not a valid generation source.
 * A missing preference row alone is valid and gets resolved by the pure
 * domain projection. No SQL error is caught or converted to defaults.
 */
export async function readReviewSnapshotSqlSourceEvidencePostgres(
  tx: postgres.TransactionSql,
  scope: ReviewSnapshotSqlSourceScope,
): Promise<ReviewSnapshotSqlSourceEvidence | null> {
  if (typeof scope.groupTrainingPlanId !== 'string' || !scope.groupTrainingPlanId.trim() ||
    typeof scope.teamId !== 'string' || !scope.teamId.trim() ||
    typeof scope.groupId !== 'string' || !scope.groupId.trim()) {
    return null
  }

  const periodization = await readReviewPlanPeriodizationFactsPostgres(tx, scope)
  if (periodization === null) return null

  const strategies = await readReviewPlanStrategyFactsPostgres(tx, scope)
  if (strategies === null) return null

  const preferences = await readReviewPlanGenerationPreferencesPostgres(tx, scope)

  const templates = await readReviewWorkoutTemplateFactsPostgres(tx, scope)
  if (templates === null) return null

  const calendar = await readReviewPlanCompetitionCalendarFactsPostgres(tx, scope)
  if (calendar === null) return null

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
}
