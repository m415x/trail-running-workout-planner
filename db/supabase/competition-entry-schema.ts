import { relations, sql } from 'drizzle-orm'
import { check, doublePrecision, index, integer, pgTable, text } from 'drizzle-orm/pg-core'

import { groupTrainingPlans } from '@/db/supabase/schema'
import type { CompetitionPriority, CompetitionStatus } from '@/types'

/**
 * PostgreSQL/Supabase persistence for CompetitionEntry.
 *
 * This mirrors the SQLite structural contract. Horizon-specific primary
 * competition rules and audience ownership remain domain/application policies
 * instead of database uniqueness constraints.
 */
export const competitionEntries = pgTable(
  'competition_entries',
  {
    id: text('id').primaryKey(),

    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    date: text('date').notNull(),
    distanceKm: doublePrecision('distance_km').notNull(),
    elevationGainM: integer('elevation_gain_m'),
    priority: text('priority').$type<CompetitionPriority>().notNull(),
    status: text('status').$type<CompetitionStatus>().notNull().default('planned'),
    description: text('description'),

    isDeleted: text('is_deleted')
      .$type<'false' | 'true'>()
      .notNull()
      .default('false'),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    index('competition_entries_plan_date_idx').on(table.groupTrainingPlanId, table.date),
    index('competition_entries_plan_status_date_idx').on(
      table.groupTrainingPlanId,
      table.status,
      table.date,
    ),
    check('competition_entries_name_check', sql`length(btrim(${table.name})) > 0`),
    check('competition_entries_distance_check', sql`${table.distanceKm} > 0`),
    check(
      'competition_entries_elevation_gain_check',
      sql`${table.elevationGainM} is null or ${table.elevationGainM} >= 0`,
    ),
    check('competition_entries_priority_check', sql`${table.priority} in ('A', 'B', 'C')`),
    check(
      'competition_entries_status_check',
      sql`${table.status} in ('planned', 'confirmed', 'completed', 'cancelled')`,
    ),
  ],
)

export const competitionEntriesRelations = relations(competitionEntries, ({ one }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [competitionEntries.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
}))
