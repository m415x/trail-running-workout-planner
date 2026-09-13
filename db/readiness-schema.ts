import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { athleteProfiles, baseColumns, teams, users, workoutLogs } from '@/db/schema'
import { competitionEntries } from '@/db/competition-entry-schema'
import type {
  ReadinessAssessment,
  ReadinessCoachDecision,
  ReadinessEvaluationPhaseResolution,
  ReadinessPolicy,
  RealizedMetricName,
  RecentPreparationSummary,
  RealizedTrainingSource,
} from '@/types'

/**
 * Sidecar evidence for workout_logs. Legacy rows without this record remain
 * readable but H12 treats default zeros as ambiguous.
 */
export const workoutLogEvidence = sqliteTable(
  'workout_log_evidence',
  {
    ...baseColumns,
    workoutLogId: text('workout_log_id')
      .notNull()
      .references(() => workoutLogs.id, { onDelete: 'cascade' }),
    source: text('source').$type<RealizedTrainingSource>().notNull().default('manual'),
    sourceActivityId: text('source_activity_id'),
    knownMetricFields: text('known_metric_fields', { mode: 'json' })
      .$type<RealizedMetricName[]>()
      .notNull(),
  },
  (table) => [
    uniqueIndex('workout_log_evidence_log_unique').on(table.workoutLogId),
    uniqueIndex('workout_log_evidence_source_activity_unique').on(table.source, table.sourceActivityId),
  ],
)

export const readinessEvaluations = sqliteTable(
  'readiness_evaluations',
  {
    ...baseColumns,
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    athleteId: text('athlete_id')
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: 'cascade' }),
    competitionEntryId: text('competition_entry_id')
      .notNull()
      .references(() => competitionEntries.id, { onDelete: 'restrict' }),
    evaluatedAt: text('evaluated_at').notNull(),
    analysisStartDate: text('analysis_start_date').notNull(),
    analysisEndDate: text('analysis_end_date').notNull(),
    policyVersion: text('policy_version').notNull(),
    policySnapshot: text('policy_snapshot', { mode: 'json' }).$type<ReadinessPolicy>().notNull(),
    preparationSnapshot: text('preparation_snapshot', { mode: 'json' }).$type<RecentPreparationSummary>().notNull(),
    phaseSnapshot: text('phase_snapshot', { mode: 'json' }).$type<ReadinessEvaluationPhaseResolution>().notNull(),
    resultSnapshot: text('result_snapshot', { mode: 'json' }).$type<ReadinessAssessment>().notNull(),
  },
  (table) => [
    index('readiness_evaluations_team_athlete_date_idx').on(table.teamId, table.athleteId, table.evaluatedAt),
    index('readiness_evaluations_competition_idx').on(table.competitionEntryId),
  ],
)

export const readinessReviews = sqliteTable(
  'readiness_reviews',
  {
    ...baseColumns,
    readinessEvaluationId: text('readiness_evaluation_id')
      .notNull()
      .references(() => readinessEvaluations.id, { onDelete: 'cascade' }),
    decision: text('decision').$type<ReadinessCoachDecision>().notNull(),
    reviewedByUserId: text('reviewed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    reviewedAt: text('reviewed_at').notNull(),
    note: text('note'),
  },
  (table) => [
    index('readiness_reviews_evaluation_date_idx').on(table.readinessEvaluationId, table.reviewedAt),
  ],
)
