import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

import type {
  UserRole,
  AthleteCategoryCode,
  AthleteLevelCode,
  AthletePhysiology,
  MedicalRecord,
  PeriodType,
  MicrocycleType,
  IntensityMethod,
  IntensityZone,
  WorkoutType,
  DayStatus,
  TestType,
  TrainingGoalType,
  TrainingGoalStatus,
  GroupTrainingPlanStatus,
  PlanningModificationField,
} from '@/types'

export const baseColumns = {
  id: text('id').primaryKey(),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
}

export const teams = sqliteTable('teams', {
  ...baseColumns,
  name: text('name').notNull(),
})

export const trainingLocations = sqliteTable('training_locations', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  description: text('description'),
})

export const users = sqliteTable('users', {
  ...baseColumns,
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').$type<UserRole>().notNull(),
  avatarUrl: text('avatar_url'),
})

export const athleteGroups = sqliteTable(
  'athlete_groups',
  {
    ...baseColumns,
    categoryCode: text('category_code').$type<AthleteCategoryCode>().notNull(),
    levelCode: text('level_code').$type<AthleteLevelCode>().notNull(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('athlete_groups_team_category_level_unique').on(
      table.teamId,
      table.categoryCode,
      table.levelCode,
    ),
  ],
)

export const athleteProfiles = sqliteTable('athlete_profiles', {
  ...baseColumns,
  userId: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  groupId: text('group_id').references(() => athleteGroups.id, { onDelete: 'set null' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  birthDate: text('birth_date'),
  gender: text('gender', { enum: ['male', 'female', 'other'] }),
  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  physiology: text('physiology', { mode: 'json' }).$type<AthletePhysiology>(),
  medical: text('medical', { mode: 'json' }).$type<MedicalRecord>(),
})

export const physiologyRecords = sqliteTable('physiology_records', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  pamTimeSec: integer('pam_time_sec').notNull(),
  pamPaceFormatted: text('pam_pace_formatted').notNull(),
  pamSpeedKmh: real('pam_speed_kmh'),
  maxHr: integer('max_hr').notNull(),
  restHr: integer('rest_hr').notNull(),
  thresholdHr: integer('threshold_hr'),
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),
  testType: text('test_type').$type<TestType>(),
  notes: text('notes'),
})

export const groupHistoryRecords = sqliteTable('group_history_records', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  previousGroupId: text('previous_group_id').references(() => athleteGroups.id, { onDelete: 'set null' }),
  newGroupId: text('new_group_id').notNull().references(() => athleteGroups.id, { onDelete: 'restrict' }),
  changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
})

export const trainingGoals = sqliteTable('training_goals', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  type: text('type').$type<TrainingGoalType>().notNull(),
  status: text('status').$type<TrainingGoalStatus>().notNull().default('draft'),
  title: text('title').notNull(),
  description: text('description'),
  targetDate: text('target_date'),
  raceName: text('race_name'),
  raceDistanceKm: real('race_distance_km'),
  raceElevationGain: integer('race_elevation_gain'),
  notes: text('notes'),
})

export const groupTrainingPlans = sqliteTable('group_training_plans', {
  ...baseColumns,
  groupId: text('group_id').notNull().references(() => athleteGroups.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  status: text('status').$type<GroupTrainingPlanStatus>().notNull().default('draft'),
  notes: text('notes'),
})

export const macrocycles = sqliteTable('macrocycles', {
  ...baseColumns,
  title: text('title').notNull(),
  groupTrainingPlanId: text('group_training_plan_id').notNull().references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  taperingWeeksCount: integer('tapering_weeks_count'),
  notes: text('notes'),
})

export const mesocycles = sqliteTable('mesocycles', {
  ...baseColumns,
  macrocycleId: text('macrocycle_id').notNull().references(() => macrocycles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  number: integer('number').notNull(),
  period: text('period').$type<PeriodType>().notNull(),
  objective: text('objective').notNull(),
})

export const microcycles = sqliteTable('microcycles', {
  ...baseColumns,
  mesocycleId: text('mesocycle_id').notNull().references(() => mesocycles.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  type: text('type').$type<MicrocycleType>().notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  targetVolumeKm: real('target_volume_km'),
  targetElevationGain: integer('target_elevation_gain'),
  targetDurationMin: integer('target_duration_min'),
  notes: text('notes'),
})

export const planningModificationRecords = sqliteTable('planning_modification_records', {
  ...baseColumns,
  groupTrainingPlanId: text('group_training_plan_id').notNull().references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),
  microcycleId: text('microcycle_id').references(() => microcycles.id, { onDelete: 'set null' }),
  field: text('field').$type<PlanningModificationField>().notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
})

export const workouts = sqliteTable('workouts', {
  ...baseColumns,
  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>().notNull(),
  zone: text('zone').$type<IntensityZone>().notNull().default('Z2'),
  distance: real('distance').notNull().default(0),
  time: integer('time').notNull().default(0),
  gain: integer('gain').notNull().default(0),
  pace: integer('pace'),
  notes: text('notes'),
  trackPath: text('track_path'),
  locationKey: text('location_key').$type<string>().references(() => trainingLocations.key),
  structure: text('structure', { mode: 'json' }).$type<{ warmup: string; mainBlock: string; cooldown: string }>(),
})

export const sessions = sqliteTable('sessions', {
  ...baseColumns,
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>(),
  locationKey: text('location_key').references(() => trainingLocations.key),
  trackPath: text('track_path'),
  notes: text('notes'),
})

export const groupSessionPrescriptions = sqliteTable(
  'group_session_prescriptions',
  {
    ...baseColumns,
    sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
    groupId: text('group_id').notNull().references(() => athleteGroups.id, { onDelete: 'cascade' }),
    microcycleId: text('microcycle_id').notNull().references(() => microcycles.id, { onDelete: 'cascade' }),
    distanceKm: real('distance_km'),
    durationMin: integer('duration_min'),
    elevationGain: integer('elevation_gain'),
    intensityMethod: text('intensity_method').$type<IntensityMethod>(),
    zone: text('zone').$type<IntensityZone>(),
    pamPercentage: real('pam_percentage'),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('group_session_prescriptions_session_group_unique').on(
      table.sessionId,
      table.groupId,
    ),
  ],
)

export const workoutLogs = sqliteTable('workout_logs', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
  date: text('date').notNull(),
  status: text('status').$type<DayStatus>().notNull().default('pending'),
  distanceKm: real('distance_km').notNull().default(0),
  durationMin: integer('duration_min').notNull().default(0),
  elevationGain: integer('elevation_gain').notNull().default(0),
  avgHr: integer('avg_hr'),
  feeling: text('feeling'),
  rpe: integer('rpe').default(0),
  athleteNotes: text('athlete_notes'),
  loggedAt: text('logged_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const memberships = sqliteTable('memberships', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  amount: real('amount').notNull(),
  status: text('status', { enum: ['active', 'pending', 'expired', 'cancelled'] }).notNull().default('pending'),
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'card', 'other'] }),
  notes: text('notes'),
})

export const shoes = sqliteTable('shoes', {
  ...baseColumns,
  athleteId: text('athlete_id').notNull().references(() => athleteProfiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  maxKm: real('max_km').notNull(),
  purchaseDate: text('purchase_date'),
  currentKm: real('current_km').notNull().default(0),
  retiredAt: text('retired_at'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
})

export const teamsRelations = relations(teams, ({ many }) => ({ athletes: many(athleteProfiles), groups: many(athleteGroups), sessions: many(sessions) }))
export const usersRelations = relations(users, ({ one, many }) => ({ athleteProfile: one(athleteProfiles, { fields: [users.id], references: [athleteProfiles.userId] }), groupChanges: many(groupHistoryRecords), planningChanges: many(planningModificationRecords) }))
export const athleteGroupsRelations = relations(athleteGroups, ({ one, many }) => ({ team: one(teams, { fields: [athleteGroups.teamId], references: [teams.id] }), athletes: many(athleteProfiles), previousGroupHistory: many(groupHistoryRecords, { relationName: 'previousGroup' }), newGroupHistory: many(groupHistoryRecords, { relationName: 'newGroup' }), sessionPrescriptions: many(groupSessionPrescriptions), trainingPlans: many(groupTrainingPlans) }))
export const athleteProfilesRelations = relations(athleteProfiles, ({ one, many }) => ({ user: one(users, { fields: [athleteProfiles.userId], references: [users.id] }), team: one(teams, { fields: [athleteProfiles.teamId], references: [teams.id] }), group: one(athleteGroups, { fields: [athleteProfiles.groupId], references: [athleteGroups.id] }), trainingGoals: many(trainingGoals), physiologyHistory: many(physiologyRecords), groupHistory: many(groupHistoryRecords), shoes: many(shoes), workoutLogs: many(workoutLogs), memberships: many(memberships) }))
export const physiologyRecordsRelations = relations(physiologyRecords, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [physiologyRecords.athleteId], references: [athleteProfiles.id] }) }))
export const groupHistoryRecordsRelations = relations(groupHistoryRecords, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [groupHistoryRecords.athleteId], references: [athleteProfiles.id] }), previousGroup: one(athleteGroups, { fields: [groupHistoryRecords.previousGroupId], references: [athleteGroups.id], relationName: 'previousGroup' }), newGroup: one(athleteGroups, { fields: [groupHistoryRecords.newGroupId], references: [athleteGroups.id], relationName: 'newGroup' }), changedBy: one(users, { fields: [groupHistoryRecords.changedByUserId], references: [users.id] }) }))
export const shoesRelations = relations(shoes, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [shoes.athleteId], references: [athleteProfiles.id] }) }))
export const membershipsRelations = relations(memberships, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [memberships.athleteId], references: [athleteProfiles.id] }) }))
export const trainingGoalsRelations = relations(trainingGoals, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [trainingGoals.athleteId], references: [athleteProfiles.id] }) }))
export const groupTrainingPlansRelations = relations(groupTrainingPlans, ({ one, many }) => ({ group: one(athleteGroups, { fields: [groupTrainingPlans.groupId], references: [athleteGroups.id] }), macrocycles: many(macrocycles), modifications: many(planningModificationRecords) }))
export const macrocyclesRelations = relations(macrocycles, ({ one, many }) => ({ groupTrainingPlan: one(groupTrainingPlans, { fields: [macrocycles.groupTrainingPlanId], references: [groupTrainingPlans.id] }), mesocycles: many(mesocycles) }))
export const mesocyclesRelations = relations(mesocycles, ({ one, many }) => ({ macrocycle: one(macrocycles, { fields: [mesocycles.macrocycleId], references: [macrocycles.id] }), microcycles: many(microcycles) }))
export const microcyclesRelations = relations(microcycles, ({ one, many }) => ({ mesocycle: one(mesocycles, { fields: [microcycles.mesocycleId], references: [mesocycles.id] }), sessionPrescriptions: many(groupSessionPrescriptions), modifications: many(planningModificationRecords) }))
export const planningModificationRecordsRelations = relations(planningModificationRecords, ({ one }) => ({ groupTrainingPlan: one(groupTrainingPlans, { fields: [planningModificationRecords.groupTrainingPlanId], references: [groupTrainingPlans.id] }), microcycle: one(microcycles, { fields: [planningModificationRecords.microcycleId], references: [microcycles.id] }), changedBy: one(users, { fields: [planningModificationRecords.changedByUserId], references: [users.id] }) }))
export const sessionsRelations = relations(sessions, ({ one, many }) => ({ team: one(teams, { fields: [sessions.teamId], references: [teams.id] }), workout: one(workouts, { fields: [sessions.workoutId], references: [workouts.id] }), location: one(trainingLocations, { fields: [sessions.locationKey], references: [trainingLocations.key] }), sessionPrescriptions: many(groupSessionPrescriptions), workoutLogs: many(workoutLogs) }))
export const groupSessionPrescriptionsRelations = relations(groupSessionPrescriptions, ({ one }) => ({ session: one(sessions, { fields: [groupSessionPrescriptions.sessionId], references: [sessions.id] }), group: one(athleteGroups, { fields: [groupSessionPrescriptions.groupId], references: [athleteGroups.id] }), microcycle: one(microcycles, { fields: [groupSessionPrescriptions.microcycleId], references: [microcycles.id] }) }))
export const workoutLogsRelations = relations(workoutLogs, ({ one }) => ({ athlete: one(athleteProfiles, { fields: [workoutLogs.athleteId], references: [athleteProfiles.id] }), session: one(sessions, { fields: [workoutLogs.sessionId], references: [sessions.id] }), workout: one(workouts, { fields: [workoutLogs.workoutId], references: [workouts.id] }) }))
