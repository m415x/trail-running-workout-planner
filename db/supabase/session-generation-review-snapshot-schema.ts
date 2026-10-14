import { check, index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { teams, users, groupTrainingPlans, athleteGroups, planningCohorts } from '@/db/supabase/schema'
import type { SharedSessionGenerationResult } from '@/types/training/session-generation.types'
import type { GenerationExplanation } from '@/lib/session-generation/generation-explanation'

/** SQL review snapshot; the opaque id does not grant authorization. */
export const sessionGenerationReviewSnapshots = pgTable(
  'session_generation_review_snapshots',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'restrict' }),
    groupTrainingPlanId: text('group_training_plan_id').notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'restrict' }),
    groupId: text('group_id').notNull().references(() => athleteGroups.id, { onDelete: 'restrict' }),
    planningCohortId: text('planning_cohort_id')
      .references(() => planningCohorts.id, { onDelete: 'restrict' }),
    schemaVersion: text('schema_version').notNull(),
    generatorVersion: text('generator_version').notNull(),
    proposal: jsonb('proposal').$type<SharedSessionGenerationResult>().notNull(),
    generationExplanations: jsonb('generation_explanations')
      .$type<Record<string, GenerationExplanation>>().notNull(),
    sourceManifest: jsonb('source_manifest').$type<unknown>().notNull(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    status: text('status', { enum: ['active', 'consumed', 'expired', 'invalidated'] })
      .notNull().default('active'),
    consumedAt: text('consumed_at'),
    resultReference: text('result_reference'),
  },
  (table) => [
    index('session_generation_review_snapshots_owner_idx')
      .on(table.userId, table.teamId, table.groupTrainingPlanId, table.status, table.expiresAt),
    index('session_generation_review_snapshots_expiry_idx').on(table.expiresAt),
    check('session_generation_review_snapshots_status_check',
      sql`${table.status} in ('active', 'consumed', 'expired', 'invalidated')`),
  ],
)
