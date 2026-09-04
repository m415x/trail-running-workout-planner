import { relations } from 'drizzle-orm'
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { groupTrainingPlans } from '@/db/schema'
import type {
  LoadStrategyFieldSources,
  TrainingGoalType,
} from '@/types'

export const loadStrategies = sqliteTable(
  'load_strategies',
  {
    id: text('id').primaryKey(),

    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

    goalType: text('goal_type').$type<TrainingGoalType>().notNull(),

    initialWeeklyVolumeKm: real('initial_weekly_volume_km').notNull(),
    maximumWeeklyVolumeKm: real('maximum_weekly_volume_km').notNull(),
    sessionsPerWeek: integer('sessions_per_week').notNull(),
    maximumWeeklyIncreasePercentage: real('maximum_weekly_increase_percentage').notNull(),
    deloadPercentage: real('deload_percentage').notNull(),
    initialWeeklyElevationGain: integer('initial_weekly_elevation_gain'),
    maximumWeeklyElevationGain: integer('maximum_weekly_elevation_gain'),

    fieldSources: text('field_sources', { mode: 'json' })
      .$type<LoadStrategyFieldSources>()
      .notNull(),

    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex('load_strategies_group_training_plan_unique').on(table.groupTrainingPlanId),
  ],
)

export const loadStrategiesRelations = relations(loadStrategies, ({ one }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [loadStrategies.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
}))
