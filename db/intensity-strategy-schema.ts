import { relations } from 'drizzle-orm'
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { groupTrainingPlans, microcycles } from '@/db/schema'
import type {
  IntensityEmphasis,
  IntensityMethod,
  IntensityStrategyFieldSources,
  IntensityZone,
  MicrocycleIntensityTargetFieldSources,
  TrainingGoalType,
} from '@/types'

export const intensityStrategies = sqliteTable(
  'intensity_strategies',
  {
    id: text('id').primaryKey(),
    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),
    goalType: text('goal_type').$type<TrainingGoalType>().notNull(),
    defaultMethod: text('default_method').$type<IntensityMethod>().notNull(),
    maximumIntenseSessionsPerWeek: integer('maximum_intense_sessions_per_week').notNull(),
    minimumRecoveryDaysBetweenIntenseSessions: integer('minimum_recovery_days_between_intense_sessions').notNull(),
    fieldSources: text('field_sources', { mode: 'json' }).$type<IntensityStrategyFieldSources>().notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('intensity_strategies_plan_unique').on(table.groupTrainingPlanId)],
)

export const microcycleIntensityTargets = sqliteTable(
  'microcycle_intensity_targets',
  {
    id: text('id').primaryKey(),
    microcycleId: text('microcycle_id')
      .notNull()
      .references(() => microcycles.id, { onDelete: 'cascade' }),
    emphasis: text('emphasis').$type<IntensityEmphasis>().notNull(),
    intenseSessionsTarget: integer('intense_sessions_target').notNull(),
    predominantZone: text('predominant_zone').$type<IntensityZone>().notNull(),
    pamPercentageTarget: real('pam_percentage_target'),
    minimumRecoveryDaysBetweenIntenseSessions: integer('minimum_recovery_days_between_intense_sessions').notNull(),
    fieldSources: text('field_sources', { mode: 'json' }).$type<MicrocycleIntensityTargetFieldSources>().notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('microcycle_intensity_targets_microcycle_unique').on(table.microcycleId)],
)

export const intensityStrategiesRelations = relations(intensityStrategies, ({ one }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [intensityStrategies.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
}))

export const microcycleIntensityTargetsRelations = relations(microcycleIntensityTargets, ({ one }) => ({
  microcycle: one(microcycles, {
    fields: [microcycleIntensityTargets.microcycleId],
    references: [microcycles.id],
  }),
}))
