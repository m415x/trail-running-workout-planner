import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

import type {
  AthleteGroupCode,
  AthletePhysiology,
  MedicalRecord,
  PeriodType,
  MicrocycleType,
  IntensityZone,
  GroupVolumeOverride,
} from '@/types'

/* -------------------------------------------------------------------------- */
/* BASE COLUMNS                                                               */
/* -------------------------------------------------------------------------- */

export const baseEntity = {
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
  ...baseEntity,
  name: text('name').notNull(),
  description: text('description'),
  avatarLight: text('avatar_light'),
  avatarDark: text('avatar_dark'),
})

export const trainingLocations = sqliteTable('training_locations', {
  key: text('key').primaryKey().$type<string>(),
  name: text('name').notNull(),
  lat: real('lat').notNull(),
  lon: real('lon').notNull(),
  description: text('description'),
})

/* -------------------------------------------------------------------------- */
/* 2. USERS & ATHLETE DATA                                                    */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable('users', {
  ...baseEntity,
  role: text('role', { enum: ['athlete', 'coach', 'admin'] })
    .notNull()
    .default('athlete'),
  teamId: text('team_id').references(() => teams.id, { onDelete: 'set null' }),
  email: text('email').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  nickName: text('nick_name'),
  dni: text('dni').notNull(),
  birthday: text('birthday'), // 'YYYY-MM-DD'
  avatar: text('avatar'),

  phone: text('phone'),
  emergencyContact: text('emergency_contact'),
  emergencyPhone: text('emergency_phone'),

  // Grupo asignado (ej: 'S2', 'G1', etc.)
  group: text('group').$type<AthleteGroupCode>().notNull().default('S2'),

  // Fisiología y datos médicos vigentes
  physiology: text('physiology', { mode: 'json' }).$type<AthletePhysiology>(),
  medical: text('medical', { mode: 'json' }).$type<MedicalRecord>(),
})

export const physiologyRecords = sqliteTable('physiology_records', {
  ...baseEntity,
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  pamTimeSec: integer('pam_time_sec').notNull(),
  pamPaceFormatted: text('pam_pace_formatted').notNull(),
  pamSpeedKmh: real('pam_speed_kmh'),
  maxHr: integer('max_hr').notNull(),
  restHr: integer('rest_hr').notNull(),
  thresholdHr: integer('threshold_hr'),
  weightKg: real('weight_kg'),
  heightCm: real('height_cm'),
  testType: text('test_type', {
    enum: ['1000m_track', 'ramp_test', 'cooper', 'field_trial'],
  }),
  notes: text('notes'),
})

export const groupHistoryRecords = sqliteTable('group_history_records', {
  ...baseEntity,
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),
  previousGroup: text('previous_group').$type<AthleteGroupCode>(),
  newGroup: text('new_group').$type<AthleteGroupCode>().notNull(),
  promotedByUserId: text('promoted_by_user_id').references(() => users.id),
  reason: text('reason'),
})

export const shoes = sqliteTable('shoes', {
  ...baseEntity,
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  currentKm: real('current_km').notNull().default(0),
  maxKm: real('max_km').notNull().default(800),
  status: text('status'), // 'Óptimo' | 'Desgaste medio' | etc.
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
})

/* -------------------------------------------------------------------------- */
/* 3. PERIODIZACIÓN Y CICLOS                                                  */
/* -------------------------------------------------------------------------- */

export const macrocycles = sqliteTable('macrocycles', {
  ...baseEntity,
  teamId: text('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  targetRaceName: text('target_race_name').notNull(),
  targetRaceDate: text('target_race_date').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  taperingWeeksCount: integer('tapering_weeks_count').notNull().default(2),
})

export const mesocycles = sqliteTable('mesocycles', {
  ...baseEntity,
  macrocycleId: text('macrocycle_id')
    .notNull()
    .references(() => macrocycles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  number: integer('number').notNull(),
  period: text('period').$type<PeriodType>().notNull(),
  objective: text('objective').notNull(),
})

export const microcycles = sqliteTable('microcycles', {
  ...baseEntity,
  mesocycleId: text('mesocycle_id').references(() => mesocycles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(), // 'Microciclo #33'
  phase: text('phase').notNull().default('Desarrollo'), // 'Base' | 'Desarrollo' | 'Choque' | 'Descarga'
  weekNumber: integer('week_number'),
  type: text('type').$type<MicrocycleType>().default('development'),
  startDate: text('start_date').notNull(), // 'YYYY-MM-DD'
  endDate: text('end_date').notNull(), // 'YYYY-MM-DD'
  targetKm: real('target_km').notNull().default(0),
  targetVolumeKmByGroup: text('target_volume_km_by_group', { mode: 'json' }).$type<
    Partial<Record<AthleteGroupCode, number>>
  >(),
  notes: text('notes'),
})

/* -------------------------------------------------------------------------- */
/* 4. WORKOUTS (CATÁLOGO / SESIONES)                                          */
/* -------------------------------------------------------------------------- */

export const workouts = sqliteTable('workouts', {
  ...baseEntity,
  title: text('title').notNull(),
  type: text('type').notNull(), // 'Base', 'Trail', 'Long', 'Intervals', 'Race', etc.
  zone: text('zone').$type<IntensityZone>().notNull().default('Z2'),
  distance: real('distance').notNull().default(0), // km
  time: integer('time').notNull().default(0), // min
  gain: integer('gain').notNull().default(0), // metros desnivel positivo
  pace: integer('pace'), // segundos por km (ej: 420 = 7:00/km)
  notes: text('notes'),
  trackPath: text('track_path'),
  locationKey: text('location_key')
    .$type<string>()
    .references(() => trainingLocations.key),

  // Estructuras avanzadas opcionales
  structure: text('structure', { mode: 'json' }).$type<{
    warmup: string
    mainBlock: string
    cooldown: string
  }>(),
  groupOverrides: text('group_overrides', { mode: 'json' }).$type<
    Partial<Record<AthleteGroupCode, GroupVolumeOverride>>
  >(),
})

/* -------------------------------------------------------------------------- */
/* 5. REGISTRO DIARIO / SELECCIÓN DE DÍAS (WeekDayRaw / Logs)                */
/* -------------------------------------------------------------------------- */

export const dailyLogs = sqliteTable('daily_logs', {
  ...baseEntity, // ej: 'usr_1_2026-08-10'
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  workoutId: text('workout_id').references(() => workouts.id, { onDelete: 'set null' }),
  type: text('type'), // 'Base', 'Intervals', etc.
  completedKm: real('completed_km'),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  isPartial: integer('is_partial', { mode: 'boolean' }).notNull().default(false),
  isMissed: integer('is_missed', { mode: 'boolean' }).notNull().default(false),
  isRest: integer('is_rest', { mode: 'boolean' }).notNull().default(false),

  // Feedback del atleta
  feeling: text('feeling'), // 'very_weak' | 'weak' | 'normal' | 'strong' | 'very_strong'
  rpe: integer('rpe').default(0), // 1 - 10
  userNotes: text('user_notes'),
})

/* -------------------------------------------------------------------------- */
/* 6. RELACIONES                                                              */
/* -------------------------------------------------------------------------- */

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(users),
  macrocycles: many(macrocycles),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  team: one(teams, { fields: [users.teamId], references: [teams.id] }),
  dailyLogs: many(dailyLogs),
  shoes: many(shoes),
  physiologyHistory: many(physiologyRecords),
  groupHistory: many(groupHistoryRecords),
}))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  location: one(trainingLocations, { fields: [workouts.locationKey], references: [trainingLocations.key] }),
  dailyLogs: many(dailyLogs),
}))

export const dailyLogsRelations = relations(dailyLogs, ({ one }) => ({
  user: one(users, { fields: [dailyLogs.userId], references: [users.id] }),
  workout: one(workouts, { fields: [dailyLogs.workoutId], references: [workouts.id] }),
}))
