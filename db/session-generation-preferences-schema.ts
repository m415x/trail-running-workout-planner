import { relations } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { groupTrainingPlans } from '@/db/schema'
import type {
  TrainingWeekday,
  WeeklySessionRole,
} from '@/types/training/session-generation.types'

export type PersistedWeeklyTrainingPatternSlot = {
  weekday: TrainingWeekday
  role: WeeklySessionRole
}

export type SessionFrequencyMode = 'auto' | 'fixed'

export const sessionGenerationPreferences = sqliteTable(
  'session_generation_preferences',
  {
    id: text('id').primaryKey(),

    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

    frequencyMode: text('frequency_mode').$type<SessionFrequencyMode>().notNull(),
    fixedSessionsPerWeek: integer('fixed_sessions_per_week'),
    weeklyPattern: text('weekly_pattern', { mode: 'json' })
      .$type<PersistedWeeklyTrainingPatternSlot[]>()
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
    uniqueIndex('session_generation_preferences_group_training_plan_unique').on(
      table.groupTrainingPlanId,
    ),
  ],
)

export const sessionGenerationPreferencesRelations = relations(
  sessionGenerationPreferences,
  ({ one }) => ({
    groupTrainingPlan: one(groupTrainingPlans, {
      fields: [sessionGenerationPreferences.groupTrainingPlanId],
      references: [groupTrainingPlans.id],
    }),
  }),
)
