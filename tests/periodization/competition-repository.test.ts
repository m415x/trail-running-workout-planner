import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as schema from '@/db/schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import {
  createCompetitionRecord,
  getCompetitionById,
  listCompetitionsByPlan,
  rescheduleCompetitionRecord,
  updateCompetitionRecord,
  updateCompetitionStatusRecord,
} from '@/lib/periodization/competition-repository'
import type { CompetitionEntryDraft } from '@/types/training/competition-entry.types'

type TestDatabase = ReturnType<typeof createTestDatabase>['database']

let sqlite: Database.Database
let database: TestDatabase

function competitionDraft(overrides: Partial<CompetitionEntryDraft> = {}): CompetitionEntryDraft {
  return {
    groupTrainingPlanId: 'plan-1',
    name: 'Patagonia Run 42K',
    date: '2027-04-12',
    distanceKm: 42,
    elevationGainM: 2100,
    priority: 'A',
    status: 'planned',
    description: 'Primary race',
    ...overrides,
  }
}

describe('competition repository', () => {
  beforeEach(() => {
    const context = createTestDatabase()
    sqlite = context.sqlite
    database = context.database
  })

  afterEach(() => sqlite.close())

  it('creates, gets and lists visible competitions in date order', () => {
    createCompetitionRecord({
      id: 'competition-2',
      draft: competitionDraft({ name: 'Later race', date: '2027-05-10', priority: 'B' }),
      createdAt: '2027-01-01T00:00:00.000Z',
    }, database)
    createCompetitionRecord({
      id: 'competition-1',
      draft: competitionDraft(),
      createdAt: '2027-01-01T00:00:00.000Z',
    }, database)

    assert.equal(getCompetitionById('competition-1', database)?.name, 'Patagonia Run 42K')
    assert.deepEqual(
      listCompetitionsByPlan('plan-1', database).map(({ id }) => id),
      ['competition-1', 'competition-2'],
    )
  })

  it('updates mutable competition fields while preserving identity and creation metadata', () => {
    createCompetitionRecord({
      id: 'competition-1',
      draft: competitionDraft(),
      createdAt: '2027-01-01T00:00:00.000Z',
    }, database)

    const updated = updateCompetitionRecord({
      id: 'competition-1',
      draft: competitionDraft({ name: 'Updated race', distanceKm: 45, priority: 'B' }),
      updatedAt: '2027-01-02T00:00:00.000Z',
    }, database)

    assert.equal(updated?.id, 'competition-1')
    assert.equal(updated?.createdAt, '2027-01-01T00:00:00.000Z')
    assert.equal(updated?.updatedAt, '2027-01-02T00:00:00.000Z')
    assert.equal(updated?.name, 'Updated race')
    assert.equal(updated?.distanceKm, 45)
    assert.equal(updated?.priority, 'B')
  })

  it('reschedules without changing lifecycle status', () => {
    createCompetitionRecord({
      id: 'competition-1',
      draft: competitionDraft({ status: 'confirmed' }),
      createdAt: '2027-01-01T00:00:00.000Z',
    }, database)

    const updated = rescheduleCompetitionRecord(
      'competition-1',
      '2027-04-26',
      '2027-01-03T00:00:00.000Z',
      database,
    )

    assert.equal(updated?.date, '2027-04-26')
    assert.equal(updated?.status, 'confirmed')
  })

  it('updates lifecycle status without deleting history', () => {
    createCompetitionRecord({
      id: 'competition-1',
      draft: competitionDraft(),
      createdAt: '2027-01-01T00:00:00.000Z',
    }, database)

    const cancelled = updateCompetitionStatusRecord(
      'competition-1',
      'cancelled',
      '2027-01-04T00:00:00.000Z',
      database,
    )

    assert.equal(cancelled?.status, 'cancelled')
    assert.equal(cancelled?.isDeleted, false)
    assert.equal(listCompetitionsByPlan('plan-1', database).length, 1)
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
      created_at TEXT,
      updated_at TEXT
    );

    INSERT INTO group_training_plans (
      id, group_id, title, status, is_deleted
    ) VALUES ('plan-1', 'group-1', 'Plan S2', 'draft', 0);

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
