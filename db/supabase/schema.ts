import { boolean, doublePrecision, integer, jsonb, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
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
  LoadStrategyFieldSources,
  PlanningModificationField,
  TargetElevationSource,
  TargetVolumeSource,
} from '@/types'
import type { SessionStructure } from '@/types/training/session.types'

/* -------------------------------------------------------------------------- */
/* BASE COLUMNS                                                               */
/* -------------------------------------------------------------------------- */

export const baseColumns = {
  id: text('id').primaryKey(),

  isDeleted: boolean('is_deleted').notNull().default(false),

  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),

  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
}

/* -------------------------------------------------------------------------- */
/* 1. TEAMS & LOCATIONS                                                       */
/* -------------------------------------------------------------------------- */

export const teams = pgTable('teams', {
  ...baseColumns,

  name: text('name').notNull(),
  description: text('description'),
  avatarLight: text('avatar_light'),
  avatarDark: text('avatar_dark'),
})

export const trainingLocations = pgTable('training_locations', {
  key: text('key').primaryKey().$type<string>(),
  name: text('name').notNull(),
  lon: doublePrecision('lon').notNull(),
  lat: doublePrecision('lat').notNull(),
  description: text('description'),
})

/* -------------------------------------------------------------------------- */
/* 2. USERS (Autenticación y datos base)                                      */
/* -------------------------------------------------------------------------- */

export const users = pgTable('users', {
  ...baseColumns,

  role: text('role').notNull().default('athlete').$type<UserRole>(),

  // Datos básicos (coincide con tipo User)
  userName: text('user_name').notNull().unique(),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  avatar: text('avatar'),
})

/* -------------------------------------------------------------------------- */
/* 3. ATHLETE GROUPS (Grupos de entrenamiento)                                */
/* -------------------------------------------------------------------------- */

export const athleteGroups = pgTable(
  'athlete_groups',
  {
    ...baseColumns,

    categoryCode: text('category_code').$type<AthleteCategoryCode>().notNull(),
    levelCode: text('level_code').$type<AthleteLevelCode>().notNull(),

    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    uniqueIndex('athlete_groups_team_category_level_unique').on(table.teamId, table.categoryCode, table.levelCode),
  ],
)

/* -------------------------------------------------------------------------- */
/* 4. ATHLETE PROFILES (Datos deportivos)                                     */
/* -------------------------------------------------------------------------- */

export const athleteProfiles = pgTable('athlete_profiles', {
  ...baseColumns,

  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),

  groupId: text('group_id').references(() => athleteGroups.id, { onDelete: 'set null' }),

  isActive: boolean('is_active').notNull().default(true),

  nickName: text('nick_name'),
  dni: text('dni').notNull(),
  birthday: text('birthday'), // 'YYYY-MM-DD'

  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),

  // Fisiología y datos médicos vigentes (calculados del último registro)
  physiology: jsonb('physiology').$type<AthletePhysiology>(),
  medical: jsonb('medical').$type<MedicalRecord>(),
})

/* -------------------------------------------------------------------------- */
/* 5. PHYSIOLOGY RECORDS (Historial de evaluaciones)                         */
/* -------------------------------------------------------------------------- */

export const physiologyRecords = pgTable('physiology_records', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  date: text('date').notNull(),

  // Test PAM / 1000m
  pamTimeSec: integer('pam_time_sec').notNull(),
  pamPaceFormatted: text('pam_pace_formatted').notNull(),
  pamSpeedKmh: doublePrecision('pam_speed_kmh'),

  // Métricas Cardíacas
  maxHr: integer('max_hr').notNull(),
  restHr: integer('rest_hr').notNull(),
  thresholdHr: integer('threshold_hr'), // Umbral de Lactato (Threshold HR / LTHR)

  // Composición corporal
  weightKg: doublePrecision('weight_kg'),
  heightCm: doublePrecision('height_cm'),

  testType: text('test_type').$type<TestType>(),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 6. GROUP HISTORY RECORDS (Historial de cambios de grupo)                   */
/* -------------------------------------------------------------------------- */

export const groupHistoryRecords = pgTable('group_history_records', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  date: text('date').notNull(),

  previousGroupId: text('previous_group_id').references(() => athleteGroups.id, { onDelete: 'set null' }),
  newGroupId: text('new_group_id')
    .notNull()
    .references(() => athleteGroups.id, { onDelete: 'restrict' }),

  changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
})

/* -------------------------------------------------------------------------- */
/* 7. TRAINING GOAL (Objetivo de entrenamiento)                               */
/* -------------------------------------------------------------------------- */

export const trainingGoals = pgTable('training_goals', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  type: text('type').$type<TrainingGoalType>().notNull(),

  status: text('status').$type<TrainingGoalStatus>().notNull().default('draft'),

  title: text('title').notNull(),
  description: text('description'),

  targetDate: text('target_date'),

  raceName: text('race_name'),
  raceDistanceKm: doublePrecision('race_distance_km'),
  raceElevationGain: integer('race_elevation_gain'),

  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 8. CICLOS                                                                  */
/* -------------------------------------------------------------------------- */

export const groupTrainingPlans = pgTable('group_training_plans', {
  ...baseColumns,

  groupId: text('group_id')
    .notNull()
    .references(() => athleteGroups.id, { onDelete: 'restrict' }),

  title: text('title').notNull(),
  status: text('status').$type<GroupTrainingPlanStatus>().notNull().default('draft'),
  notes: text('notes'),
})

export const loadStrategies = pgTable(
  'load_strategies',
  {
    ...baseColumns,

    groupTrainingPlanId: text('group_training_plan_id')
      .notNull()
      .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

    goalType: text('goal_type').$type<TrainingGoalType>().notNull(),

    initialWeeklyVolumeKm: doublePrecision('initial_weekly_volume_km').notNull(),
    maximumWeeklyVolumeKm: doublePrecision('maximum_weekly_volume_km').notNull(),
    sessionsPerWeek: integer('sessions_per_week').notNull(),
    maximumWeeklyIncreasePercentage: doublePrecision('maximum_weekly_increase_percentage').notNull(),
    deloadPercentage: doublePrecision('deload_percentage').notNull(),
    initialWeeklyElevationGain: integer('initial_weekly_elevation_gain'),
    maximumWeeklyElevationGain: integer('maximum_weekly_elevation_gain'),

    fieldSources: jsonb('field_sources').$type<LoadStrategyFieldSources>().notNull(),
  },
  (table) => [
    uniqueIndex('load_strategies_group_training_plan_unique').on(table.groupTrainingPlanId),
  ],
)

export const macrocycles = pgTable('macrocycles', {
  ...baseColumns,

  title: text('title').notNull(),
  groupTrainingPlanId: text('group_training_plan_id')
    .notNull()
    .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  taperingWeeksCount: integer('tapering_weeks_count'),

  targetRaceName: text('target_race_name'),
  targetRaceDistanceKm: doublePrecision('target_race_distance_km'),
  targetRaceElevationGain: integer('target_race_elevation_gain'),

  notes: text('notes'),
})

export const mesocycles = pgTable('mesocycles', {
  ...baseColumns,

  macrocycleId: text('macrocycle_id')
    .notNull()
    .references(() => macrocycles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  number: integer('number').notNull(),
  period: text('period').$type<PeriodType>().notNull(),
  objective: text('objective').notNull(),
})

export const microcycles = pgTable('microcycles', {
  ...baseColumns,

  mesocycleId: text('mesocycle_id')
    .notNull()
    .references(() => mesocycles.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  type: text('type').$type<MicrocycleType>().notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),

  targetVolumeKm: doublePrecision('target_volume_km'),
  targetVolumeSource: text('target_volume_source')
    .$type<TargetVolumeSource>()
    .notNull()
    .default('generated'),
  targetElevationGain: integer('target_elevation_gain'),
  targetElevationSource: text('target_elevation_source')
    .$type<TargetElevationSource>()
    .notNull()
    .default('generated'),
  targetDurationMin: integer('target_duration_min'),
  notes: text('notes'),
})

export const planningModificationRecords = pgTable('planning_modification_records', {
  ...baseColumns,

  groupTrainingPlanId: text('group_training_plan_id')
    .notNull()
    .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

  microcycleId: text('microcycle_id').references(() => microcycles.id, { onDelete: 'set null' }),
  field: text('field').$type<PlanningModificationField>().notNull(),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
})

/* -------------------------------------------------------------------------- */
/* 9. WORKOUTS (Catálogo / Plantillas Reutilizables)                          */
/* -------------------------------------------------------------------------- */
export const workouts = pgTable('workouts', {
  ...baseColumns,

  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>().notNull(), // 'Base', 'Intervals', 'Trail', etc.
  zone: text('zone').$type<IntensityZone>().notNull().default('Z2'),
  distance: doublePrecision('distance').notNull().default(0), // km
  time: integer('time').notNull().default(0), // min
  gain: integer('gain').notNull().default(0), // m
  pace: integer('pace'), // seg/km
  notes: text('notes'), // Instrucciones técnicas generales
  trackPath: text('track_path'),
  locationKey: text('location_key')
    .$type<string>()
    .references(() => trainingLocations.key),

  // Estructura interna del entrenamiento
  structure: jsonb('structure').$type<{
    warmup: string
    mainBlock: string
    cooldown: string
  }>(),
})

/* -------------------------------------------------------------------------- */
/* 10. SESSIONS (Días específicos en el Calendario del Microciclo)            */
/* -------------------------------------------------------------------------- */
export const sessions = pgTable('sessions', {
  ...baseColumns,

  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),

  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),

  date: text('date').notNull(),
  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>().notNull(),

  locationKey: text('location_key').references(() => trainingLocations.key),

  trackPath: text('track_path'),
  structure: jsonb('structure').$type<SessionStructure>(),

  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 11. GROUP SESSION PRESCRIPTIONS (Indicaciones para sesiones grupales)      */
/* -------------------------------------------------------------------------- */
export const groupSessionPrescriptions = pgTable(
  'group_session_prescriptions',
  {
    ...baseColumns,

    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),

    groupId: text('group_id')
      .notNull()
      .references(() => athleteGroups.id, { onDelete: 'cascade' }),

    microcycleId: text('microcycle_id')
      .notNull()
      .references(() => microcycles.id, { onDelete: 'cascade' }),

    distanceKm: doublePrecision('distance_km'),
    durationMin: integer('duration_min'),
    elevationGain: integer('elevation_gain'),

    intensityMethod: text('intensity_method').$type<IntensityMethod>(),
    zone: text('zone').$type<IntensityZone>(),
    pamPercentage: doublePrecision('pam_percentage'),

    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('group_session_prescriptions_session_group_unique').on(table.sessionId, table.groupId),
  ],
)

/* -------------------------------------------------------------------------- */
/* 12. WORKOUT LOGS (Registro de ejecución + Estado del día)                  */
/* -------------------------------------------------------------------------- */

export const workoutLogs = pgTable('workout_logs', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  // Referencias a lo que estaba planificado
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),

  date: text('date').notNull(), // 'YYYY-MM-DD'

  // DayStatus = 'completed' | 'partial' | 'missed' | 'pending' | 'rest'
  status: text('status').$type<DayStatus>().notNull().default('pending'),

  // Datos del entrenamiento realizado (si status es 'completed' o 'partial')
  distanceKm: doublePrecision('distance_km').notNull().default(0),
  durationMin: integer('duration_min').notNull().default(0),
  elevationGain: integer('elevation_gain').notNull().default(0),
  avgHr: integer('avg_hr'),

  // Feedback del atleta
  feeling: text('feeling'),
  rpe: integer('rpe').default(0),
  athleteNotes: text('athlete_notes'),

  loggedAt: text('logged_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

/* -------------------------------------------------------------------------- */
/* 13. MEMBRESÍAS (Para el dashboard del coach)                               */
/* -------------------------------------------------------------------------- */

export const memberships = pgTable('memberships', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  amount: doublePrecision('amount').notNull(),
  status: text('status', { enum: ['active', 'pending', 'expired', 'cancelled'] })
    .notNull()
    .default('pending'),
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'card', 'other'] }),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 14. SHOES (Calzado del atleta)                                              */
/* -------------------------------------------------------------------------- */

export const shoes = pgTable('shoes', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  type: text('type').notNull(), // Ej: "Trail / Competición"
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  maxKm: doublePrecision('max_km').notNull(), // Ej: 800 km
  purchaseDate: text('purchase_date'),

  currentKm: doublePrecision('current_km').notNull().default(0),
  retiredAt: text('retired_at'), // Fecha cuando se dejó de usar
  notes: text('notes'),

  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false),
})

/* -------------------------------------------------------------------------- */
/* 15. RELACIONES                                                             */
/* -------------------------------------------------------------------------- */

export const teamsRelations = relations(teams, ({ many }) => ({
  athletes: many(athleteProfiles),
  groups: many(athleteGroups),
  sessions: many(sessions),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  athleteProfile: one(athleteProfiles, {
    fields: [users.id],
    references: [athleteProfiles.userId],
  }),
  groupChanges: many(groupHistoryRecords),
  planningChanges: many(planningModificationRecords),
}))

export const athleteGroupsRelations = relations(athleteGroups, ({ one, many }) => ({
  team: one(teams, {
    fields: [athleteGroups.teamId],
    references: [teams.id],
  }),
  athletes: many(athleteProfiles),
  previousGroupHistory: many(groupHistoryRecords, {
    relationName: 'previousGroup',
  }),
  newGroupHistory: many(groupHistoryRecords, {
    relationName: 'newGroup',
  }),
  sessionPrescriptions: many(groupSessionPrescriptions),
  trainingPlans: many(groupTrainingPlans),
}))

export const athleteProfilesRelations = relations(athleteProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [athleteProfiles.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [athleteProfiles.teamId],
    references: [teams.id],
  }),
  group: one(athleteGroups, {
    fields: [athleteProfiles.groupId],
    references: [athleteGroups.id],
  }),
  trainingGoals: many(trainingGoals),
  physiologyHistory: many(physiologyRecords),
  groupHistory: many(groupHistoryRecords),
  shoes: many(shoes),
  workoutLogs: many(workoutLogs),
  memberships: many(memberships),
}))

export const physiologyRecordsRelations = relations(physiologyRecords, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [physiologyRecords.athleteId], references: [athleteProfiles.id] }),
}))

export const groupHistoryRecordsRelations = relations(groupHistoryRecords, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [groupHistoryRecords.athleteId],
    references: [athleteProfiles.id],
  }),
  previousGroup: one(athleteGroups, {
    fields: [groupHistoryRecords.previousGroupId],
    references: [athleteGroups.id],
    relationName: 'previousGroup',
  }),
  newGroup: one(athleteGroups, {
    fields: [groupHistoryRecords.newGroupId],
    references: [athleteGroups.id],
    relationName: 'newGroup',
  }),
  changedBy: one(users, {
    fields: [groupHistoryRecords.changedByUserId],
    references: [users.id],
  }),
}))

export const shoesRelations = relations(shoes, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [shoes.athleteId], references: [athleteProfiles.id] }),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [memberships.athleteId],
    references: [athleteProfiles.id],
  }),
}))

// Relaciones de Planificación

export const trainingGoalsRelations = relations(trainingGoals, ({ one }) => ({
  athlete: one(athleteProfiles, {
    fields: [trainingGoals.athleteId],
    references: [athleteProfiles.id],
  }),
}))

export const groupTrainingPlansRelations = relations(groupTrainingPlans, ({ one, many }) => ({
  group: one(athleteGroups, {
    fields: [groupTrainingPlans.groupId],
    references: [athleteGroups.id],
  }),
  macrocycles: many(macrocycles),
  modifications: many(planningModificationRecords),
  loadStrategy: one(loadStrategies),
}))

export const loadStrategiesRelations = relations(loadStrategies, ({ one }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [loadStrategies.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
}))

export const macrocyclesRelations = relations(macrocycles, ({ one, many }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [macrocycles.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
  mesocycles: many(mesocycles),
}))

export const mesocyclesRelations = relations(mesocycles, ({ one, many }) => ({
  macrocycle: one(macrocycles, { fields: [mesocycles.macrocycleId], references: [macrocycles.id] }),
  microcycles: many(microcycles),
}))

export const microcyclesRelations = relations(microcycles, ({ one, many }) => ({
  mesocycle: one(mesocycles, {
    fields: [microcycles.mesocycleId],
    references: [mesocycles.id],
  }),
  sessionPrescriptions: many(groupSessionPrescriptions),
  modifications: many(planningModificationRecords),
}))

export const planningModificationRecordsRelations = relations(planningModificationRecords, ({ one }) => ({
  groupTrainingPlan: one(groupTrainingPlans, {
    fields: [planningModificationRecords.groupTrainingPlanId],
    references: [groupTrainingPlans.id],
  }),
  microcycle: one(microcycles, {
    fields: [planningModificationRecords.microcycleId],
    references: [microcycles.id],
  }),
  changedBy: one(users, {
    fields: [planningModificationRecords.changedByUserId],
    references: [users.id],
  }),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  team: one(teams, {
    fields: [sessions.teamId],
    references: [teams.id],
  }),
  workout: one(workouts, {
    fields: [sessions.workoutId],
    references: [workouts.id],
  }),
  location: one(trainingLocations, {
    fields: [sessions.locationKey],
    references: [trainingLocations.key],
  }),
  sessionPrescriptions: many(groupSessionPrescriptions),
  workoutLogs: many(workoutLogs),
}))

export const groupSessionPrescriptionsRelations = relations(groupSessionPrescriptions, ({ one }) => ({
  session: one(sessions, {
    fields: [groupSessionPrescriptions.sessionId],
    references: [sessions.id],
  }),
  group: one(athleteGroups, {
    fields: [groupSessionPrescriptions.groupId],
    references: [athleteGroups.id],
  }),
  microcycle: one(microcycles, {
    fields: [groupSessionPrescriptions.microcycleId],
    references: [microcycles.id],
  }),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  location: one(trainingLocations, {
    fields: [workouts.locationKey],
    references: [trainingLocations.key],
  }),
  sessions: many(sessions),
  workoutLogs: many(workoutLogs),
}))

export const workoutLogsRelations = relations(workoutLogs, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [workoutLogs.athleteId], references: [athleteProfiles.id] }),
  session: one(sessions, { fields: [workoutLogs.sessionId], references: [sessions.id] }),
  workout: one(workouts, { fields: [workoutLogs.workoutId], references: [workouts.id] }),
}))
