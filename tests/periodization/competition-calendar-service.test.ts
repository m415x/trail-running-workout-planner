import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as competitionEntrySchema from '@/db/competition-entry-schema'
import * as intensityStrategySchema from '@/db/intensity-strategy-schema'
import * as loadStrategySchema from '@/db/load-strategy-schema'
import * as readinessSchema from '@/db/readiness-schema'
import * as schema from '@/db/schema'
import * as sessionGenerationPreferencesSchema from '@/db/session-generation-preferences-schema'
import {
  changeCompetitionStatus,
  createCompetition,
  getCompetitionCalendar,
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
    name: 'Patagonia Run 42K',
    date: '2027-04-12',
    distanceKm: 42,
    elevationGainM: 2100,
    priority: 'A',
    status: 'planned',
    description: 'Primary competition',
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

describe('competition calendar service', () => {
  beforeEach(() => {
    const context = createTestDatabase()
    sqlite = context.sqlite
    database = context.database
  })

  afterEach(() => sqlite.close())

  it('creates and reads a competition inside the plan horizon', () => {
    const created = createCompetition({
      ...mutationContext(),
      id: 'competition-1',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft(),
    })

    assert.equal(created.ok, true)
    assert.equal(getCompetitionCalendar('plan-1', database).length, 1)
    assert.equal(getCompetitionCalendar('plan-1', database)[0]?.id, 'competition-1')
  })

  it('allows multiple B/C competitions', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-b',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ priority: 'B' }),
    })

    const result = createCompetition({
      ...mutationContext(),
      id: 'competition-c',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ name: 'Secondary event', priority: 'C' }),
    })

    assert.equal(result.ok, true)
  })

  it('rejects a second active A competition in the same planning horizon', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-a',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft(),
    })

    const conflict = createCompetition({
      ...mutationContext(),
      id: 'competition-a-2',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ name: 'Another A', date: '2027-05-10' }),
    })

    assert.equal(conflict.ok, false)
    if (!conflict.ok) assert.ok(conflict.errors.includes('competition_calendar_multiple_active_primary'))
  })

  it('reschedules a competition without changing lifecycle', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-b',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ priority: 'B' }),
    })

    const result = rescheduleCompetition({
      ...mutationContext(),
      competitionId: 'competition-b',
      date: '2027-04-12',
      now: '2027-01-02T00:00:00.000Z',
    })

    assert.equal(result.ok, true)
    assert.equal(getCompetitionCalendar('plan-1', database)[0]?.date, '2027-04-12')
  })

  it('updates sporting fields without changing identity', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-b',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ priority: 'B' }),
    })

    const updated = updateCompetition({
      ...mutationContext(),
      competitionId: 'competition-b',
      now: '2027-01-02T00:00:00.000Z',
      draft: draft({
        name: 'Updated competition',
        distanceKm: 50,
        priority: 'B',
      }),
    })

    assert.equal(updated.ok, true)
    if (updated.ok) {
      assert.equal(updated.value.id, 'competition-b')
      assert.equal(updated.value.name, 'Updated competition')
      assert.equal(updated.value.distanceKm, 50)
    }
  })

  it('cancels without deleting history', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-a',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft(),
    })

    const cancelled = changeCompetitionStatus({
      ...mutationContext(),
      competitionId: 'competition-a',
      status: 'cancelled',
      now: '2027-01-04T00:00:00.000Z',
    })

    assert.equal(cancelled.ok, true)
    assert.equal(getCompetitionCalendar('plan-1', database)[0]?.status, 'cancelled')
    assert.equal(getCompetitionCalendar('plan-1', database)[0]?.isDeleted, false)
  })

  it('rejects an invalid lifecycle transition', () => {
    createCompetition({
      ...mutationContext(),
      id: 'competition-cancelled',
      now: '2027-01-01T00:00:00.000Z',
      draft: draft({ status: 'cancelled' }),
    })

    const result = changeCompetitionStatus({
      ...mutationContext(),
      competitionId: 'competition-cancelled',
      status: 'planned',
      now: '2027-01-05T00:00:00.000Z',
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.deepEqual(result.errors, ['competition_lifecycle_transition_not_allowed'])
    }
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
        ...readinessSchema,
      },
    }),
  }
}
