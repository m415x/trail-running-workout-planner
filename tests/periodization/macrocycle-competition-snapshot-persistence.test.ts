import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as competitionSchema from '@/db/competition-entry-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as schema from '@/db/schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import { groupTrainingPlans, macrocycles } from '@/db/schema'
import { buildLoadProgressionPreview } from '@/lib/periodization/load-progression-preview'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { persistProgression } from '@/lib/periodization/progression-persistence'

type TestDatabase = ReturnType<typeof createTestDatabase>['database']

let sqlite: Database.Database
let database: TestDatabase

describe('snapshot competitivo histórico del macrociclo', () => {
  beforeEach(() => {
    const testContext = createTestDatabase()
    sqlite = testContext.sqlite
    database = testContext.database

    database.insert(groupTrainingPlans).values({
      id: 'plan-1',
      groupId: 'group-1',
      title: 'Plan S2',
    }).run()
    database.insert(macrocycles).values({
      id: 'macro-1',
      groupTrainingPlanId: 'plan-1',
      title: 'Macrociclo S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
    }).run()
  })

  afterEach(() => sqlite.close())

  it('copia la competencia usada sólo al persistir explícitamente la planificación', () => {
    const planning = buildLoadProgressionPreview({
      title: 'Macrociclo S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'race'),
      targetRace: {
        name: 'Carrera objetivo',
        distanceKm: 21,
        elevationGain: 900,
      },
    }).planning

    // The H9 generator supplies the competition date in its immutable snapshot.
    // The legacy preview used by this persistence fixture predates that boundary,
    // so the date is added explicitly to exercise the new persisted field.
    if (planning.race) {
      planning.race.date = '2026-03-01'
    }

    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })

    const saved = database.select().from(macrocycles)
      .where(eq(macrocycles.id, 'macro-1'))
      .get()

    assert.equal(saved?.targetRaceName, 'Carrera objetivo')
    assert.equal(saved?.targetRaceDate, '2026-03-01')
    assert.equal(saved?.targetRaceDistanceKm, 21)
    assert.equal(saved?.targetRaceElevationGain, 900)
    assert.equal(saved?.taperingWeeksCount, 2)
  })

  it('una revisión explícita sin competencia reemplaza el snapshot anterior', () => {
    database.update(macrocycles).set({
      targetRaceName: 'Snapshot anterior',
      targetRaceDate: '2026-03-01',
      targetRaceDistanceKm: 42,
      targetRaceElevationGain: 1_500,
      taperingWeeksCount: 3,
    }).where(eq(macrocycles.id, 'macro-1')).run()

    const planning = buildLoadProgressionPreview({
      title: 'Macrociclo S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'base'),
    }).planning

    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })

    const saved = database.select().from(macrocycles)
      .where(eq(macrocycles.id, 'macro-1'))
      .get()

    assert.equal(saved?.targetRaceName, null)
    assert.equal(saved?.targetRaceDate, null)
    assert.equal(saved?.targetRaceDistanceKm, null)
    assert.equal(saved?.targetRaceElevationGain, null)
    assert.equal(saved?.taperingWeeksCount, 0)
  })

  it('una persistencia de carga puede preservar el snapshot competitivo aceptado', () => {
    database.update(macrocycles).set({
      targetRaceName: 'Snapshot histórico',
      targetRaceDate: '2026-03-01',
      targetRaceDistanceKm: 42,
      targetRaceElevationGain: 1_500,
      taperingWeeksCount: 3,
    }).where(eq(macrocycles.id, 'macro-1')).run()

    const planning = buildLoadProgressionPreview({
      title: 'Macrociclo S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'base'),
    }).planning

    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      competitionSnapshotMode: 'preserve',
      database,
    })

    const saved = database.select().from(macrocycles)
      .where(eq(macrocycles.id, 'macro-1'))
      .get()

    assert.equal(saved?.targetRaceName, 'Snapshot histórico')
    assert.equal(saved?.targetRaceDate, '2026-03-01')
    assert.equal(saved?.targetRaceDistanceKm, 42)
    assert.equal(saved?.targetRaceElevationGain, 1_500)
    assert.equal(saved?.taperingWeeksCount, 3)
  })
})

function createTestDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      group_id TEXT NOT NULL, planning_cohort_id TEXT, source_group_training_plan_id TEXT,
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', notes TEXT
    );
    CREATE TABLE macrocycles (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL, group_training_plan_id TEXT NOT NULL, start_date TEXT NOT NULL,
      end_date TEXT NOT NULL, tapering_weeks_count INTEGER, target_race_name TEXT,
      target_race_date TEXT, target_race_distance_km REAL, target_race_elevation_gain INTEGER, notes TEXT
    );
    CREATE TABLE mesocycles (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      macrocycle_id TEXT NOT NULL, title TEXT NOT NULL, number INTEGER NOT NULL,
      period TEXT NOT NULL, objective TEXT NOT NULL
    );
    CREATE TABLE microcycles (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      mesocycle_id TEXT NOT NULL, week_number INTEGER NOT NULL, type TEXT NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, target_volume_km REAL,
      target_volume_source TEXT NOT NULL DEFAULT 'generated', target_elevation_gain INTEGER,
      target_elevation_source TEXT NOT NULL DEFAULT 'generated',
      target_duration_min INTEGER, notes TEXT
    );
  `)

  return {
    sqlite,
    database: drizzle(sqlite, {
      schema: {
        ...schema,
        ...competitionSchema,
        ...loadStrategySchema,
        ...intensityStrategySchema,
        ...sessionGenerationPreferencesSchema,
      },
    }),
  }
}
