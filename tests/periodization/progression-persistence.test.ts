import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as schema from '@/db/schema'
import {
  groupTrainingPlans,
  macrocycles,
  mesocycles,
  microcycles,
} from '@/db/schema'
import { buildLoadProgressionPreview } from '@/lib/periodization/load-progression-preview'
import { suggestLoadStrategy } from '@/lib/periodization/load-strategy-recommender'
import { persistProgression } from '@/lib/periodization/progression-persistence'

type TestDatabase = ReturnType<typeof createTestDatabase>['database']

let sqlite: Database.Database
let database: TestDatabase

describe('persistencia de la progresión de carga', () => {
  beforeEach(() => {
    const testContext = createTestDatabase()
    sqlite = testContext.sqlite
    database = testContext.database
    seedPlan(database)
  })

  afterEach(() => sqlite.close())

  it('crea la progresión y un segundo guardado actualiza sin duplicar', () => {
    const planning = createPlanning()

    const firstResult = persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })
    const secondResult = persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })

    assert.equal(firstResult.createdMesocycles, 2)
    assert.equal(firstResult.createdMicrocycles, 8)
    assert.equal(secondResult.createdMesocycles, 0)
    assert.equal(secondResult.createdMicrocycles, 0)
    assert.equal(secondResult.updatedMesocycles, 2)
    assert.equal(secondResult.updatedMicrocycles, 8)
    assert.equal(database.select().from(mesocycles).all().length, 2)
    const savedMicrocycles = database.select().from(microcycles).all()
    assert.equal(savedMicrocycles.length, 8)
    assert.equal(savedMicrocycles.every((week) => week.targetElevationSource === 'generated'), true)
  })

  it('conserva fechas, tipo y notas editados al guardar un volumen manual', () => {
    const planning = createPlanning()
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })
    const week = database.select().from(microcycles)
      .where(eq(microcycles.weekNumber, 2))
      .get()

    assert.ok(week)
    database.update(microcycles).set({
      startDate: '2026-01-13',
      endDate: '2026-01-19',
      type: 'shock',
      notes: 'Ajuste deliberado del profesor',
      targetVolumeKm: 34.5,
      targetVolumeSource: 'manual',
    }).where(eq(microcycles.id, week.id)).run()

    const regenerated = createPlanning([
      {
        id: week.id,
        weekNumber: 2,
        targetVolumeKm: 34.5,
        targetVolumeSource: 'manual',
        targetElevationGain: week.targetElevationGain,
        targetElevationSource: week.targetElevationSource,
      },
    ])
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: regenerated,
      database,
    })

    const savedWeek = database.select().from(microcycles)
      .where(eq(microcycles.id, week.id))
      .get()
    assert.equal(savedWeek?.startDate, '2026-01-13')
    assert.equal(savedWeek?.endDate, '2026-01-19')
    assert.equal(savedWeek?.type, 'shock')
    assert.equal(savedWeek?.notes, 'Ajuste deliberado del profesor')
    assert.equal(savedWeek?.targetVolumeKm, 34.5)
    assert.equal(savedWeek?.targetVolumeSource, 'manual')
  })

  it('persiste el D+ manual en regeneraciones sucesivas sin duplicar semanas', () => {
    const planning = createPlanning()
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })
    const week = database.select().from(microcycles)
      .where(eq(microcycles.weekNumber, 4))
      .get()

    assert.ok(week)
    database.update(microcycles).set({
      targetElevationGain: 1_250,
      targetElevationSource: 'manual',
    }).where(eq(microcycles.id, week.id)).run()

    const regenerated = createPlanning([{
      id: week.id,
      weekNumber: week.weekNumber,
      targetVolumeKm: week.targetVolumeKm,
      targetVolumeSource: week.targetVolumeSource,
      targetElevationGain: 1_250,
      targetElevationSource: 'manual',
    }])

    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: regenerated,
      database,
    })
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: regenerated,
      database,
    })

    const savedWeek = database.select().from(microcycles)
      .where(eq(microcycles.id, week.id))
      .get()
    assert.equal(savedWeek?.targetElevationGain, 1_250)
    assert.equal(savedWeek?.targetElevationSource, 'manual')
    assert.equal(database.select().from(microcycles).all().length, 8)
  })

  it('convierte las últimas semanas existentes en taper y carrera y guarda el conteo', () => {
    const initialPlanning = createPlanning()
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: initialPlanning,
      database,
    })
    const existingMicrocycles = database.select().from(microcycles).all().map((week) => ({
      id: week.id,
      weekNumber: week.weekNumber,
      targetVolumeKm: week.targetVolumeKm,
      targetVolumeSource: week.targetVolumeSource,
      targetElevationGain: week.targetElevationGain,
      targetElevationSource: week.targetElevationSource,
    }))
    const racePlanning = buildLoadProgressionPreview({
      title: 'Macrociclo S2',
      startDate: '2026-01-05',
      endDate: '2026-03-01',
      loadStrategy: suggestLoadStrategy('S2', 'race'),
      targetRace: {
        name: 'Carrera objetivo',
        distanceKm: 21,
        elevationGain: 900,
      },
      existingMicrocycles,
    }).planning

    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: racePlanning,
      database,
    })

    const savedMacrocycle = database.select().from(macrocycles)
      .where(eq(macrocycles.id, 'macro-1'))
      .get()
    const competitiveMesocycle = database.select().from(mesocycles)
      .where(eq(mesocycles.period, 'competitive'))
      .get()
    const competitiveWeeks = database.select().from(microcycles)
      .where(eq(microcycles.mesocycleId, competitiveMesocycle!.id))
      .all()
      .sort((first, second) => first.weekNumber - second.weekNumber)

    assert.equal(savedMacrocycle?.taperingWeeksCount, 2)
    assert.deepEqual(competitiveWeeks.map((week) => week.type), ['tapering', 'race'])
    assert.equal(competitiveWeeks.at(-1)?.targetVolumeKm, 21)
    assert.equal(competitiveWeeks.at(-1)?.targetElevationGain, 900)
  })

  it('rechaza una propuesta inválida antes de realizar escrituras', () => {
    const planning = createPlanning()
    planning.mesocycles[1].microcycles[0].weekNumber = 1

    assert.throws(() => persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    }), /semana 1 está duplicada/)
    assert.equal(database.select().from(mesocycles).all().length, 0)
    assert.equal(database.select().from(microcycles).all().length, 0)
  })

  it('desactiva semanas de entrenamiento obsoletas sin tocar bloques protegidos', () => {
    const planning = createPlanning()
    persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    })
    insertProtectedBlock(database)

    const shortenedPlanning = {
      ...planning,
      mesocycles: planning.mesocycles.slice(0, 1),
    }
    const result = persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning: shortenedPlanning,
      database,
    })

    const staleWeeks = database.select().from(microcycles)
      .all()
      .filter((week) => week.weekNumber >= 5 && week.weekNumber <= 8)
    const protectedWeek = database.select().from(microcycles)
      .where(eq(microcycles.id, 'race-week'))
      .get()
    const staleMesocycle = database.select().from(mesocycles)
      .where(eq(mesocycles.number, 2))
      .get()

    assert.equal(result.deactivatedMicrocycles, 4)
    assert.equal(staleWeeks.every((week) => week.isDeleted), true)
    assert.equal(staleMesocycle?.isDeleted, true)
    assert.equal(protectedWeek?.isDeleted, false)
  })

  it('rechaza una propuesta que invade un bloque competitivo sin escribir cambios', () => {
    insertProtectedBlock(database, 1)
    const planning = createPlanning()

    assert.throws(() => persistProgression({
      groupTrainingPlanId: 'plan-1',
      macrocycleId: 'macro-1',
      planning,
      database,
    }), /reservado para un bloque competitivo o de transición/)
    assert.equal(database.select().from(mesocycles).all().length, 1)
    assert.equal(database.select().from(microcycles).all().length, 1)
  })
})

function createTestDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      group_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', notes TEXT
    );
    CREATE TABLE macrocycles (
      id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, is_deleted INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL, group_training_plan_id TEXT NOT NULL, start_date TEXT NOT NULL,
      end_date TEXT NOT NULL, tapering_weeks_count INTEGER, target_race_name TEXT,
      target_race_distance_km REAL, target_race_elevation_gain INTEGER, notes TEXT
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
      schema: { ...schema, ...loadStrategySchema, ...intensityStrategySchema },
    }),
  }
}

function seedPlan(testDatabase: TestDatabase) {
  testDatabase.insert(groupTrainingPlans).values({
    id: 'plan-1',
    groupId: 'group-1',
    title: 'Plan S2',
  }).run()
  testDatabase.insert(macrocycles).values({
    id: 'macro-1',
    groupTrainingPlanId: 'plan-1',
    title: 'Macrociclo S2',
    startDate: '2026-01-05',
    endDate: '2026-03-01',
  }).run()
}

function createPlanning(existingMicrocycles: Parameters<typeof buildLoadProgressionPreview>[0]['existingMicrocycles'] = []) {
  return buildLoadProgressionPreview({
    title: 'Macrociclo S2',
    startDate: '2026-01-05',
    endDate: '2026-03-01',
    loadStrategy: suggestLoadStrategy('S2', 'base'),
    existingMicrocycles,
  }).planning
}

function insertProtectedBlock(testDatabase: TestDatabase, number = 3) {
  testDatabase.insert(mesocycles).values({
    id: 'race-block',
    macrocycleId: 'macro-1',
    title: 'Competencia',
    number,
    period: 'competitive',
    objective: 'Carrera objetivo',
  }).run()
  testDatabase.insert(microcycles).values({
    id: 'race-week',
    mesocycleId: 'race-block',
    weekNumber: 12,
    type: 'race',
    startDate: '2026-03-23',
    endDate: '2026-03-29',
    targetVolumeKm: 42,
    targetVolumeSource: 'manual',
    notes: 'No modificar',
  }).run()
}
