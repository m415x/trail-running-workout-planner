import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as intensitySchema from '@/db/intensity-strategy-schema'
import { intensityStrategies, microcycleIntensityTargets } from '@/db/intensity-strategy-schema'
import * as loadSchema from '@/db/load-strategy-schema'
import { loadStrategies } from '@/db/load-strategy-schema'
import * as coreSchema from '@/db/schema'
import { athleteGroups, groupTrainingPlans, macrocycles, mesocycles, microcycles, teams } from '@/db/schema'
import { persistIntensityPlanning } from '@/lib/periodization/intensity-persistence'
import { calculateMicrocycleIntensityTarget } from '@/lib/periodization/microcycle-intensity-target'
import { suggestIntensityStrategy } from '@/lib/periodization/intensity-strategy-recommender'

type TestDatabase = ReturnType<typeof createTestDatabase>['database']

let sqlite: Database.Database
let database: TestDatabase

describe('persistencia de intensidad', () => {
  beforeEach(() => {
    const context = createTestDatabase()
    sqlite = context.sqlite
    database = context.database
    seedPlan(database)
  })

  afterEach(() => sqlite.close())

  it('guarda estrategia y objetivo sin duplicarlos', () => {
    const strategy = suggestIntensityStrategy('S2', 'performance')
    const target = calculateMicrocycleIntensityTarget({
      period: 'specific_preparatory',
      microcycleType: 'development',
      intensityStrategy: strategy,
    })

    const persist = () => persistIntensityPlanning({
      groupTrainingPlanId: 'plan-1',
      strategy,
      targets: [{ microcycleId: 'micro-1', target }],
      database,
    })

    persist()
    persist()

    assert.equal(database.select().from(intensityStrategies).all().length, 1)
    assert.equal(database.select().from(microcycleIntensityTargets).all().length, 1)
  })

  it('preserva un PAM manual al regenerar', () => {
    const strategy = suggestIntensityStrategy('S2', 'performance')
    const target = calculateMicrocycleIntensityTarget({
      period: 'specific_preparatory',
      microcycleType: 'development',
      intensityStrategy: strategy,
    })

    persistIntensityPlanning({
      groupTrainingPlanId: 'plan-1', strategy,
      targets: [{ microcycleId: 'micro-1', target }], database,
    })
    const saved = database.select().from(microcycleIntensityTargets).get()
    assert.ok(saved)
    database.update(microcycleIntensityTargets).set({
      pamPercentageTarget: 95,
      fieldSources: { ...saved.fieldSources, pamPercentageTarget: 'manual' },
    }).where(eq(microcycleIntensityTargets.id, saved.id)).run()

    persistIntensityPlanning({
      groupTrainingPlanId: 'plan-1', strategy,
      targets: [{ microcycleId: 'micro-1', target }], database,
    })

    const regenerated = database.select().from(microcycleIntensityTargets).get()
    assert.equal(regenerated?.pamPercentageTarget, 95)
    assert.equal(regenerated?.fieldSources.pamPercentageTarget, 'manual')
  })

  it('rechaza una propuesta inválida sin escribir intensidad', () => {
    const strategy = suggestIntensityStrategy('S2', 'performance')
    const target = calculateMicrocycleIntensityTarget({
      period: 'specific_preparatory',
      microcycleType: 'development',
      intensityStrategy: strategy,
    })

    assert.throws(() => persistIntensityPlanning({
      groupTrainingPlanId: 'plan-1',
      strategy,
      targets: [{
        microcycleId: 'micro-1',
        target: { ...target, intenseSessionsTarget: 3 },
      }],
      database,
    }), /supera el máximo/)
    assert.equal(database.select().from(intensityStrategies).all().length, 0)
    assert.equal(database.select().from(microcycleIntensityTargets).all().length, 0)
  })
})

function createTestDatabase() {
  const sqliteDatabase = new Database(':memory:')
  sqliteDatabase.exec(`
    CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, avatar_light TEXT, avatar_dark TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE athlete_groups (id TEXT PRIMARY KEY, team_id TEXT NOT NULL, category_code TEXT NOT NULL, level_code TEXT NOT NULL, description TEXT, is_active INTEGER DEFAULT 1, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE group_training_plans (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT DEFAULT 'draft', notes TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE load_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL UNIQUE, goal_type TEXT NOT NULL, initial_weekly_volume_km REAL NOT NULL, maximum_weekly_volume_km REAL NOT NULL, sessions_per_week INTEGER NOT NULL, maximum_weekly_increase_percentage REAL NOT NULL, deload_percentage REAL NOT NULL, initial_weekly_elevation_gain INTEGER, maximum_weekly_elevation_gain INTEGER, field_sources TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE macrocycles (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL, title TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, tapering_weeks_count INTEGER, target_race_name TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER, notes TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE mesocycles (id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, title TEXT NOT NULL, number INTEGER NOT NULL, period TEXT NOT NULL, objective TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE microcycles (id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, week_number INTEGER NOT NULL, type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL, target_volume_source TEXT DEFAULT 'generated', target_elevation_gain INTEGER, target_elevation_source TEXT DEFAULT 'generated', target_duration_min INTEGER, notes TEXT, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE intensity_strategies (id TEXT PRIMARY KEY, group_training_plan_id TEXT NOT NULL UNIQUE, goal_type TEXT NOT NULL, default_method TEXT NOT NULL, maximum_intense_sessions_per_week INTEGER NOT NULL, minimum_recovery_days_between_intense_sessions INTEGER NOT NULL, field_sources TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE microcycle_intensity_targets (id TEXT PRIMARY KEY, microcycle_id TEXT NOT NULL UNIQUE, emphasis TEXT NOT NULL, intense_sessions_target INTEGER NOT NULL, predominant_zone TEXT NOT NULL, pam_percentage_target REAL, minimum_recovery_days_between_intense_sessions INTEGER NOT NULL, field_sources TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
  `)

  return {
    sqlite: sqliteDatabase,
    database: drizzle(sqliteDatabase, {
      schema: { ...coreSchema, ...loadSchema, ...intensitySchema },
    }),
  }
}

function seedPlan(testDatabase: TestDatabase) {
  testDatabase.insert(teams).values({ id: 'team-1', name: 'EPT' }).run()
  testDatabase.insert(athleteGroups).values({
    id: 'group-1', teamId: 'team-1', categoryCode: 'S', levelCode: '2',
  }).run()
  testDatabase.insert(groupTrainingPlans).values({
    id: 'plan-1', groupId: 'group-1', title: 'Plan S2',
  }).run()
  testDatabase.insert(loadStrategies).values({
    id: 'load-1', groupTrainingPlanId: 'plan-1', goalType: 'performance',
    initialWeeklyVolumeKm: 20, maximumWeeklyVolumeKm: 30, sessionsPerWeek: 4,
    maximumWeeklyIncreasePercentage: 10, deloadPercentage: 20,
    initialWeeklyElevationGain: null, maximumWeeklyElevationGain: null,
    fieldSources: {
      initialWeeklyVolumeKm: 'suggested', maximumWeeklyVolumeKm: 'suggested',
      sessionsPerWeek: 'suggested', maximumWeeklyIncreasePercentage: 'suggested',
      deloadPercentage: 'suggested', initialWeeklyElevationGain: 'suggested',
      maximumWeeklyElevationGain: 'suggested',
    },
  }).run()
  testDatabase.insert(macrocycles).values({
    id: 'macro-1', groupTrainingPlanId: 'plan-1', title: 'Macro',
    startDate: '2026-01-05', endDate: '2026-01-11',
  }).run()
  testDatabase.insert(mesocycles).values({
    id: 'meso-1', macrocycleId: 'macro-1', title: 'Meso', number: 1,
    period: 'specific_preparatory', objective: 'Rendimiento',
  }).run()
  testDatabase.insert(microcycles).values({
    id: 'micro-1', mesocycleId: 'meso-1', weekNumber: 1, type: 'development',
    startDate: '2026-01-05', endDate: '2026-01-11',
  }).run()
}
