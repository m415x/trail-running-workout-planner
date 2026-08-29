import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

import type {
  UserRole,
  AthleteGroupCode,
  AthletePhysiology,
  MedicalRecord,
  PeriodType,
  MicrocycleType,
  IntensityZone,
  GroupVolumeOverride,
  WorkoutType,
  DayStatus,
  TestType,
} from '@/types'

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
/* 3. ATHLETE PROFILES (Datos deportivos)                                     */
/* -------------------------------------------------------------------------- */

export const athleteProfiles = sqliteTable('athlete_profiles', {
  ...baseColumns,
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(), // Relación 1:1 con users
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
  group: text('group').$type<AthleteGroupCode>().notNull().default('B3'),

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

/* -------------------------------------------------------------------------- */
/* 4. PHYSIOLOGY RECORDS (Historial de evaluaciones)                         */
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
/* 5. GROUP HISTORY RECORDS (Historial de cambios de grupo)                   */
/* -------------------------------------------------------------------------- */

export const groupHistoryRecords = sqliteTable('group_history_records', {
  ...baseColumns,
  athleteId: text('athlete_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'cascade' }),

  date: text('date').notNull(),
  previousGroup: text('previous_group').$type<AthleteGroupCode>(),
  newGroup: text('new_group').$type<AthleteGroupCode>().notNull(),
  promotedByUserId: text('promoted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
})

/* -------------------------------------------------------------------------- */
/* 6. SHOES (Calzado del atleta)                                              */
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
/* 7. CICLOS                                                                  */
/* -------------------------------------------------------------------------- */

export const macrocycles = sqliteTable('macrocycles', {
  ...baseColumns,
  group: text('group').$type<AthleteGroupCode>().notNull(),
  title: text('title').notNull(),
  targetRaceName: text('target_race_name').notNull(),
  targetRaceDate: text('target_race_date').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  taperingWeeksCount: integer('tapering_weeks_count').notNull().default(2),
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
  targetVolumeKmByGroup: text('target_volume_km_by_group', { mode: 'json' }).$type<
    Partial<Record<AthleteGroupCode, number>>
  >(),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 8. WORKOUTS (Catálogo / Plantillas Reutilizables)                          */
/* -------------------------------------------------------------------------- */
export const workouts = sqliteTable('workouts', {
  ...baseColumns,
  title: text('title').notNull(),
  type: text('type').$type<WorkoutType>().notNull(), // 'Base', 'Intervals', 'Trail', etc.
  zone: text('zone').$type<IntensityZone>().notNull().default('Z2'),
  distance: real('distance').notNull().default(0), // km
  time: integer('time').notNull().default(0), // min
  gain: integer('gain').notNull().default(0), // m
  pace: integer('pace'), // seg/km
  notes: text('notes'), // Instrucciones técnicas generales
  trackPath: text('track_path'),
  locationKey: text('location_key')
    .$type<string>()
    .references(() => trainingLocations.key),

  // Estructura interna del entrenamiento
  structure: text('structure', { mode: 'json' }).$type<{
    warmup: string
    mainBlock: string
    cooldown: string
  }>(),
})

/* -------------------------------------------------------------------------- */
/* 9. SESSIONS (Días específicos en el Calendario del Microciclo)             */
/* -------------------------------------------------------------------------- */
export const sessions = sqliteTable('sessions', {
  ...baseColumns,
  microcycleId: text('microcycle_id')
    .notNull()
    .references(() => microcycles.id, { onDelete: 'cascade' }),

  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),

  date: text('date').notNull(),
  title: text('title').notNull(), // ✅ Agregado para coincidir con tu interfaz
  type: text('type').$type<WorkoutType>().notNull(),
  zone: text('zone').$type<IntensityZone>().notNull().default('Z2'),
  locationKey: text('location_key')
    .$type<string>()
    .references(() => trainingLocations.key),
  trackPath: text('track_path'),

  defaultVolume: text('default_volume', { mode: 'json' }).$type<{ km: number; timeMin: number }>(),
  structure: text('structure', { mode: 'json' }).$type<{
    preliminaryExercises?: string
    warmup: string
    mainBlock: string
    cooldown: string
  }>(),

  groupOverrides: text('group_overrides', { mode: 'json' }).$type<
    Partial<Record<AthleteGroupCode, GroupVolumeOverride>>
  >(),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 10. WORKOUT LOGS (Registro de ejecución + Estado del día)                  */
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
/* 11. MEMBRESÍAS (Para el dashboard del coach)                               */
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
/* 12. RELACIONES                                                             */
/* -------------------------------------------------------------------------- */

export const teamsRelations = relations(teams, ({ many }) => ({
  athletes: many(athleteProfiles),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  athleteProfile: one(athleteProfiles, { fields: [users.id], references: [athleteProfiles.userId] }),
  memberships: many(memberships),
}))

export const athleteProfilesRelations = relations(athleteProfiles, ({ one, many }) => ({
  user: one(users, { fields: [athleteProfiles.userId], references: [users.id] }),
  team: one(teams, { fields: [athleteProfiles.teamId], references: [teams.id] }),

  physiologyHistory: many(physiologyRecords),
  groupHistory: many(groupHistoryRecords),
  shoes: many(shoes),
  workoutLogs: many(workoutLogs),
}))

export const physiologyRecordsRelations = relations(physiologyRecords, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [physiologyRecords.athleteId], references: [athleteProfiles.id] }),
}))

export const groupHistoryRecordsRelations = relations(groupHistoryRecords, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [groupHistoryRecords.athleteId], references: [athleteProfiles.id] }),
  promotedBy: one(users, { fields: [groupHistoryRecords.promotedByUserId], references: [users.id] }),
}))

export const shoesRelations = relations(shoes, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [shoes.athleteId], references: [athleteProfiles.id] }),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.athleteId], references: [users.id] }),
}))

// Relaciones de Planificación

export const macrocyclesRelations = relations(macrocycles, ({ many }) => ({
  mesocycles: many(mesocycles),
}))

export const mesocyclesRelations = relations(mesocycles, ({ one, many }) => ({
  macrocycle: one(macrocycles, { fields: [mesocycles.macrocycleId], references: [macrocycles.id] }),
  microcycles: many(microcycles),
}))

export const microcyclesRelations = relations(microcycles, ({ one, many }) => ({
  mesocycle: one(mesocycles, { fields: [microcycles.mesocycleId], references: [mesocycles.id] }),
  sessions: many(sessions),
}))

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  microcycle: one(microcycles, { fields: [sessions.microcycleId], references: [microcycles.id] }),
  location: one(trainingLocations, { fields: [sessions.locationKey], references: [trainingLocations.key] }),
  workoutLogs: many(workoutLogs),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  location: one(trainingLocations, { fields: [workouts.locationKey], references: [trainingLocations.key] }),
  workoutLogs: many(workoutLogs),
}))

export const workoutLogsRelations = relations(workoutLogs, ({ one }) => ({
  athlete: one(athleteProfiles, { fields: [workoutLogs.athleteId], references: [athleteProfiles.id] }),
  session: one(sessions, { fields: [workoutLogs.sessionId], references: [sessions.id] }),
  workout: one(workouts, { fields: [workoutLogs.workoutId], references: [workouts.id] }),
}))
