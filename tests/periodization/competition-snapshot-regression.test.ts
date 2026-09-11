import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as schema from '@/db/schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import { macrocycles } from '@/db/schema'
import {
  createCompetition,
  rescheduleCompetition,
  updateCompetition,
} from '@/lib/periodization/competition-calendar-service'
import type { CompetitionEntryDraft } from '@/types/training/competition-entry.types'

type TestDatabase = ReturnType<typeof createTestDatabase>['database']

let sqlite: Database.Database
let database: TestDatabase

function draft(overrides: Partial<CompetitionEntryDraft> = {}): CompetitionEntryDraft {
  return {
    groupTrainingPlanId: 'plan-1',
    name: 'Snapshot Race',
    date: '2027-04-12',
    distanceKm: 42,
    elevationGainM: 2100,
    priority: 'A',
    status: 'confirmed',
    description: null,
    ...overrides,
  }
}

function mutationContext() {
  return {
    planId: 'plan-1',
    planKind: 'group_base' as const,
    coversEntirePlanAudience: true,
    database,
  }
}

describe('historical competition snapshot regression', () => {
  beforeEach(() => {
    const context = createTestDatabase()
    sqlite = context.sqlite
    database = context.database
  })

  afterEach(() => sqlite.close())

  it('does not silently rewrite an accepted macrocycle snapshot when the live competition is edited or rescheduled', () => {
    const created = createCompetition({
      ...mutationContext(),
      id: 'competition-a',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft(),
    })
    assert.equal(created.ok, true)

    database.update(macrocycles).set({
      targetRaceName: 'Snapshot Race',
      targetRaceDate: '2027-04-12',
      targetRaceDistanceKm: 42,
      targetRaceElevationGain: 2100,
    }).where(eq(macrocycles.id, 'macro-1')).run()

    const updated = updateCompetition({
      ...mutationContext(),
      competitionId: 'competition-a',
      now: '2027-01-02T00:00:00.000Z',
      draft: draft({
        name: 'Renamed Live Race',
        distanceKm: 50,
        elevationGainM: 2600,
      }),
    })
    assert.equal(updated.ok, true)

    const rescheduled = rescheduleCompetition({
      ...mutationContext(),
      competitionId: 'competition-a',
      date: '2027-05-10',
      now: '2027-01-03T00:00:00.000Z',
    })
    assert.equal(rescheduled.ok, true)

    const snapshot = database.select().from(macrocycles)
      .where(eq(macrocycles.id, 'macro-1')).get()

    assert.equal(snapshot?.targetRaceName, 'Snapshot Race')
    assert.equal(snapshot?.targetRaceDate, '2027-04-12')
    assert.equal(snapshot?.targetRaceDistanceKm, 42)
    assert.equal(snapshot?.targetRaceElevationGain, 2100)
  })
})

function createTestDatabase() {
  const sqliteDatabase = new Database(':memory:')

  sqliteDatabase.exec(`
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY NOT NULL,
      group_id TEXT NOT NULL,
      planning_cohort_id TEXT,
      source_group_training_plan_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE macrocycles (
      id TEXT PRIMARY KEY NOT NULL,
      group_training_plan_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      tapering_weeks_count INTEGER,
      target_race_name TEXT,
      target_race_date TEXT,
      target_race_distance_km REAL,
      target_race_elevation_gain INTEGER,
      notes TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE competition_entries (
      id TEXT PRIMARY KEY NOT NULL,
      group_training_plan_id TEXT NOT NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      distance_km REAL NOT NULL,
      elevation_gain_m REAL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planned',
      description TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    INSERT INTO group_training_plans (
      id, group_id, title, status, is_deleted, created_at, updated_at
    ) VALUES (
      'plan-1', 'group-1', 'Plan S2', 'draft', 0,
      '2027-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'
    );

    INSERT INTO macrocycles (
      id, group_training_plan_id, title, start_date, end_date,
      is_deleted, created_at, updated_at
    ) VALUES (
      'macro-1', 'plan-1', '2027 season', '2027-01-01', '2027-06-30',
      0, '2027-01-01T00:00:00.000Z', '2027-01-01T00:00:00.000Z'
    );
  `)

  return {
    sqlite: sqliteDatabase,
    database: drizzle(sqliteDatabase, {
      schema: {
        ...schema,
        ...loadStrategySchema,
        ...intensityStrategySchema,
        ...sessionGenerationPreferencesSchema,
        ...competitionEntrySchema,
      },
    }),
  }
}
