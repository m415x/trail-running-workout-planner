import { check, index, sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'

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
  TargetElevationSource,
  TargetVolumeSource,
  WorkoutTemplateCategory,
  PlanningCohortStatus,
} from '@/types'
import type { SessionStructure } from '@/types/training/session.types'
import type {
  SessionGenerationModificationAction,
  SessionGenerationOwnership,
} from '@/types/training/session-generation.types'

/* -------------------------------------------------------------------------- */
/* BASE COLUMNS                                                               */
/* -------------------------------------------------------------------------- */

export const baseColumns = {
  id: text('id').primaryKey(),

  isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),

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

export const teams = sqliteTable('teams', {
  ...baseColumns,

  name: text('name').notNull(),
  description: text('description'),
  avatarLight: text('avatar_light'),
  avatarDark: text('avatar_dark'),
})

export const trainingLocations = sqliteTable('training_locations', {
  key: text('key').primaryKey().$type<string>(),
  name: text('name').notNull(),
  lon: real('lon').notNull(),
  lat: real('lat').notNull(),
  description: text('description'),
})

/* -------------------------------------------------------------------------- */
/* 2. USERS (Autenticación y datos base)                                      */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable('users', {
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

export const athleteGroups = sqliteTable(
  'athlete_groups',
  {
    ...baseColumns,

    categoryCode: text('category_code').$type<AthleteCategoryCode>().notNull(),
    levelCode: text('level_code').$type<AthleteLevelCode>().notNull(),

    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),

    description: text('description'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [
    uniqueIndex('athlete_groups_team_category_level_unique').on(table.teamId, table.categoryCode, table.levelCode),
  ],
)

export const planningCohorts = sqliteTable(
  'planning_cohorts',
  {
    ...baseColumns,
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    groupId: text('group_id')
      .notNull()
      .references(() => athleteGroups.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    purpose: text('purpose').notNull(),
    description: text('description'),
    status: text('status').$type<PlanningCohortStatus>().notNull().default('active'),
  },
  (table) => [
    index('planning_cohorts_team_group_status_idx').on(table.teamId, table.groupId, table.status),
    check('planning_cohorts_status_check', sql`${table.status} in ('active', 'archived')`),
  ],
)

/* -------------------------------------------------------------------------- */
/* 4. ATHLETE PROFILES (Datos deportivos)                                     */
/* -------------------------------------------------------------------------- */

export const athleteProfiles = sqliteTable('athlete_profiles', {
  ...baseColumns,

  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),

  groupId: text('group_id').references(() => athleteGroups.id, { onDelete: 'set null' }),

  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  nickName: text('nick_name'),
  dni: text('dni').notNull(),
  birthday: text('birthday'), // 'YYYY-MM-DD'

  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),

  // Fisiología y datos médicos vigentes (calculados del último registro)
  physiology: text('physiology', { mode: 'json' }).$type<AthletePhysiology>(),
  medical: text('medical', { mode: 'json' }).$type<MedicalRecord>(),
})

export const planningCohortMemberships = sqliteTable(
  'planning_cohort_memberships',
  {
    ...baseColumns,
    planningCohortId: text('planning_cohort_id')
      .notNull()
      .references(() => planningCohorts.id, { onDelete: 'cascade' }),
    athleteProfileId: text('athlete_profile_id')
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: 'cascade' }),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
    assignedByUserId: text('assigned_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignmentReason: text('assignment_reason'),
    endedByUserId: text('ended_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    endReason: text('end_reason'),
  },
  (table) => [
    index('planning_cohort_memberships_cohort_dates_idx').on(
      table.planningCohortId,
      table.startDate,
      table.endDate,
    ),
    index('planning_cohort_memberships_athlete_dates_idx').on(
      table.athleteProfileId,
      table.startDate,
      table.endDate,
    ),
    check(
      'planning_cohort_memberships_date_order_check',
      sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`,
    ),
    check(
      'planning_cohort_memberships_open_end_metadata_check',
      sql`${table.endDate} is not null or (${table.endedByUserId} is null and ${table.endReason} is null)`,
    ),
  ],
)

/* -------------------------------------------------------------------------- */
/* 5. PHYSIOLOGY RECORDS (Historial de evaluaciones)                         */
/* -------------------------------------------------------------------------- */

export const physiologyRecords = sqliteTable('physiology_records', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  date: text('date').notNull(),

  // Test PAM / 1000m
  pamTimeSec: integer('pam_time_sec').notNull(),
  pamPaceFormatted: text('pam_pace_formatted').notNull(),
  pamSpeedKmh: real('pam_speed_kmh'),

  // Métricas Cardíacas
  maxHr: integer('max_hr').notNull(),
  restHr: integer('rest_hr').notNull(),
  thresholdHr: integer('threshold_hr'), // Umbral de Lactato (Threshold HR / LTHR)

  // Composición corporal
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),

  testType: text('test_type').$type<TestType>(),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 6. GROUP HISTORY RECORDS (Historial de cambios de grupo)                   */
/* -------------------------------------------------------------------------- */

export const groupHistoryRecords = sqliteTable('group_history_records', {
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

export const trainingGoals = sqliteTable('training_goals', {
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
  raceDistanceKm: real('race_distance_km'),
  raceElevationGain: integer('race_elevation_gain'),

  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 8. CICLOS                                                                  */
/* -------------------------------------------------------------------------- */

export const groupTrainingPlans = sqliteTable(
  'group_training_plans',
  {
    ...baseColumns,

    groupId: text('group_id')
      .notNull()
      .references(() => athleteGroups.id, { onDelete: 'restrict' }),
    planningCohortId: text('planning_cohort_id')
      .references(() => planningCohorts.id, { onDelete: 'restrict' }),
    sourceGroupTrainingPlanId: text('source_group_training_plan_id')
      .references((): AnySQLiteColumn => groupTrainingPlans.id, {
        onDelete: 'restrict',
      }),

    title: text('title').notNull(),
    status: text('status').$type<GroupTrainingPlanStatus>().notNull().default('draft'),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('group_training_plans_planning_cohort_unique').on(table.planningCohortId),
    index('group_training_plans_source_idx').on(table.sourceGroupTrainingPlanId),
    check(
      'group_training_plans_cohort_source_pair_check',
      sql`(${table.planningCohortId} is null and ${table.sourceGroupTrainingPlanId} is null) or (${table.planningCohortId} is not null and ${table.sourceGroupTrainingPlanId} is not null)`,
    ),
    check(
      'group_training_plans_source_not_self_check',
      sql`${table.sourceGroupTrainingPlanId} is null or ${table.sourceGroupTrainingPlanId} <> ${table.id}`,
    ),
  ],
)

export const macrocycles = sqliteTable('macrocycles', {
  ...baseColumns,

  title: text('title').notNull(),
  groupTrainingPlanId: text('group_training_plan_id')
    .notNull()
    .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),

  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  taperingWeeksCount: integer('tapering_weeks_count'),

  targetRaceName: text('target_race_name'),
  targetRaceDate: text('target_race_date'),
  targetRaceDistanceKm: real('target_race_distance_km'),
  targetRaceElevationGain: integer('target_race_elevation_gain'),

  notes: text('notes'),
})

export const mesocycles = sqliteTable('mesocycles', {
  ...baseColumns,

  macrocycleId: text('macrocycle_id')
    .notNull()
    .references(() => macrocycles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  number: integer('number').notNull(),
  period: text('period').$type<PeriodType>().notNull(),
  objective: text('objective').notNull(),
})

export const microcycles = sqliteTable('microcycles', {
  ...baseColumns,

  mesocycleId: text('mesocycle_id')
    .notNull()
    .references(() => mesocycles.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  type: text('type').$type<MicrocycleType>().notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),

  targetVolumeKm: real('target_volume_km'),
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

export const planningModificationRecords = sqliteTable('planning_modification_records', {
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
export const workouts = sqliteTable('workouts', {
  ...baseColumns,

  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),

  category: text('category').$type<WorkoutTemplateCategory>().notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull(),
  archivedAt: text('archived_at'),

  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>().notNull(), // 'Base', 'Intervals', 'Trail', etc.
  distance: real('distance'), // km
  time: integer('time'), // min
  gain: integer('gain'), // m D+
  intensityMethod: text('intensity_method').$type<IntensityMethod>(),
  zone: text('zone').$type<IntensityZone>(),
  pamPercentage: real('pam_percentage'),
  pace: integer('pace'), // seg/km
  notes: text('notes'), // Indicaciones generales de la sesión
  prescriptionNotes: text('prescription_notes'),
  trackPath: text('track_path'),
  locationKey: text('location_key')
    .$type<string>()
    .references(() => trainingLocations.key),

  // Estructura interna del entrenamiento
  structure: text('structure', { mode: 'json' }).$type<SessionStructure>(),
})

/* -------------------------------------------------------------------------- */
/* 10. SESSIONS (Días específicos en el Calendario del Microciclo)            */
/* -------------------------------------------------------------------------- */
export const sessions = sqliteTable('sessions', {
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
  structure: text('structure', { mode: 'json' }).$type<SessionStructure>(),

  notes: text('notes'),
  generationOwnership: text('generation_ownership')
    .$type<SessionGenerationOwnership>()
    .notNull()
    .default('manual'),
  sharedEventKey: text('shared_event_key'),
}, (table) => [
  uniqueIndex('sessions_shared_event_key_unique').on(table.sharedEventKey),
])

/* -------------------------------------------------------------------------- */
/* 11. GROUP SESSION PRESCRIPTIONS (Indicaciones para sesiones grupales)      */
/* -------------------------------------------------------------------------- */
export const groupSessionPrescriptions = sqliteTable(
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

    distanceKm: real('distance_km'),
    durationMin: integer('duration_min'),
    elevationGain: integer('elevation_gain'),

    intensityMethod: text('intensity_method').$type<IntensityMethod>(),
    zone: text('zone').$type<IntensityZone>(),
    pamPercentage: real('pam_percentage'),

    notes: text('notes'),
    generationOwnership: text('generation_ownership')
      .$type<SessionGenerationOwnership>()
      .notNull()
      .default('manual'),
    generationKey: text('generation_key'),
  },
  (table) => [
    uniqueIndex('group_session_prescriptions_session_group_unique').on(table.sessionId, table.groupId),
    uniqueIndex('group_session_prescriptions_generation_key_unique').on(table.generationKey),
  ],
)

export const sessionGenerationModificationRecords = sqliteTable('session_generation_modification_records', {
  ...baseColumns,
  groupTrainingPlanId: text('group_training_plan_id')
    .notNull()
    .references(() => groupTrainingPlans.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  prescriptionId: text('prescription_id')
    .references(() => groupSessionPrescriptions.id, { onDelete: 'set null' }),
  action: text('action').$type<SessionGenerationModificationAction>().notNull(),
  ownership: text('ownership').$type<SessionGenerationOwnership>().notNull(),
  generationKey: text('generation_key'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  changedByUserId: text('changed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
})

/* -------------------------------------------------------------------------- */
/* 12. WORKOUT LOGS (Registro de ejecución + Estado del día)                  */
/* -------------------------------------------------------------------------- */

export const workoutLogs = sqliteTable('workout_logs', {
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
  distanceKm: real('distance_km').notNull().default(0),
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

export const memberships = sqliteTable('memberships', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  amount: real('amount').notNull(),
  status: text('status', { enum: ['active', 'pending', 'expired', 'cancelled'] })
    .notNull()
    .default('pending'),
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'card', 'other'] }),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 14. SHOES (Calzado del atleta)                                              */
/* -------------------------------------------------------------------------- */

export const shoes = sqliteTable('shoes', {
  ...baseColumns,

  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  type: text('type').notNull(), // Ej: "Trail / Competición"
  brand: text('brand').notNull(),
  model: text('model').notNull(),
  maxKm: real('max_km').notNull(), // Ej: 800 km
  purchaseDate: text('purchase_date'),

  currentKm: real('current_km').notNull().default(0),
  retiredAt: text('retired_at'), // Fecha cuando se dejó de usar
  notes: text('notes'),

  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
})

/* -------------------------------------------------------------------------- */
/* 15. RELACIONES                                                             */
/* -------------------------------------------------------------------------- */

export const teamsRelations = relations(teams, ({ many }) => ({
  athletes: many(athleteProfiles),
  groups: many(athleteGroups),
  planningCohorts: many(planningCohorts),
  sessions: many(sessions),
  workouts: many(workouts),
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
  planningCohorts: many(planningCohorts),
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
  planningCohortMemberships: many(planningCohortMemberships),
}))

export const planningCohortsRelations = relations(planningCohorts, ({ one, many }) => ({
  team: one(teams, {
    fields: [planningCohorts.teamId],
    references: [teams.id],
  }),
  group: one(athleteGroups, {
    fields: [planningCohorts.groupId],
    references: [athleteGroups.id],
  }),
  memberships: many(planningCohortMemberships),
  planningVariant: one(groupTrainingPlans),
}))

export const planningCohortMembershipsRelations = relations(planningCohortMemberships, ({ one }) => ({
  planningCohort: one(planningCohorts, {
    fields: [planningCohortMemberships.planningCohortId],
    references: [planningCohorts.id],
  }),
  athleteProfile: one(athleteProfiles, {
    fields: [planningCohortMemberships.athleteProfileId],
    references: [athleteProfiles.id],
  }),
  assignedBy: one(users, {
    fields: [planningCohortMemberships.assignedByUserId],
    references: [users.id],
    relationName: 'planningCohortMembershipAssignedBy',
  }),
  endedBy: one(users, {
    fields: [planningCohortMemberships.endedByUserId],
    references: [users.id],
    relationName: 'planningCohortMembershipEndedBy',
  }),
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
  planningCohort: one(planningCohorts, {
    fields: [groupTrainingPlans.planningCohortId],
    references: [planningCohorts.id],
  }),
  sourceGroupTrainingPlan: one(groupTrainingPlans, {
    fields: [groupTrainingPlans.sourceGroupTrainingPlanId],
    references: [groupTrainingPlans.id],
    relationName: 'planningVariantSource',
  }),
  derivedVariants: many(groupTrainingPlans, {
    relationName: 'planningVariantSource',
  }),
  macrocycles: many(macrocycles),
  modifications: many(planningModificationRecords),
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
  team: one(teams, {
    fields: [workouts.teamId],
    references: [teams.id],
  }),
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
