import { relations, sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { groupTrainingPlans } from '@/db/schema'
import type { CompetitionPriority, CompetitionStatus } from '@/types'

/**
 * SQLite persistence for CompetitionEntry.
 *
 * Domain rules that depend on macrocycle horizon, ownership audience or
 * primary-competition resolution remain application-level policies. This table
 * only enforces structural invariants that can be expressed safely in SQL.
 */
export const competitionEntries = sqliteTable(
  'competition_entries',
  {
    id: text('id').primaryKey(),

    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    date: text('date').notNull(),
    distanceKm: real('distance_km').notNull(),
    elevationGainM: real('elevation_gain_m'),
    priority: text('priority').$type<CompetitionPriority>().notNull(),
    status: text('status').$type<CompetitionStatus>().notNull().default('planned'),
    description: text('description'),

    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
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
    check('competition_entries_name_check', sql`length(trim(${table.name})) > 0`),
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
