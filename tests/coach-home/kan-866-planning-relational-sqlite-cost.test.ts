import assert from 'node:assert/strict'
import { test } from 'node:test'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from '@/db/schema'

/**
 * SQL-level witness for the precise relational shape getCoachPlanningListResult
 * uses on dev. This does not replace H2/H3/H4A scope authorization tests.
 * The source currently hydrates all matched plans; report that cost explicitly.
 */
test('KAN-866/T3 real SQLite Coach planning relation query is bounded in SQL statements, not hydrated size', async () => {
  const trace: string[] = []
  const sqlite = new Database(':memory:', {
    verbose: (statement) => { if (typeof statement === 'string') trace.push(statement) },
  })
  try {
    sqlite.exec(`
      CREATE TABLE teams (
        id TEXT PRIMARY KEY, name TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE athlete_groups (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, category_code TEXT NOT NULL, level_code TEXT NOT NULL,
        description TEXT, is_active INTEGER NOT NULL DEFAULT 1,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE planning_cohorts (
        id TEXT PRIMARY KEY, team_id TEXT NOT NULL, group_id TEXT NOT NULL, name TEXT NOT NULL,
        purpose TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'active',
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE group_training_plans (
        id TEXT PRIMARY KEY, group_id TEXT NOT NULL, planning_cohort_id TEXT,
        source_group_training_plan_id TEXT, title TEXT NOT NULL, status TEXT NOT NULL,
        notes TEXT, is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE macrocycles (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, group_training_plan_id TEXT NOT NULL,
        start_date TEXT NOT NULL, end_date TEXT NOT NULL, tapering_weeks_count INTEGER,
        target_race_name TEXT, target_race_date TEXT, target_race_distance_km REAL,
        target_race_elevation_gain INTEGER, notes TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE mesocycles (
        id TEXT PRIMARY KEY, macrocycle_id TEXT NOT NULL, title TEXT NOT NULL,
        number INTEGER NOT NULL, period TEXT NOT NULL, objective TEXT NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE microcycles (
        id TEXT PRIMARY KEY, mesocycle_id TEXT NOT NULL, week_number INTEGER NOT NULL,
        type TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL,
        target_volume_km REAL, target_volume_source TEXT NOT NULL DEFAULT 'generated',
        target_elevation_gain INTEGER, target_elevation_source TEXT NOT NULL DEFAULT 'generated',
        target_duration_min INTEGER, notes TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
    `)
    const now = '2026-11-03T00:00:00.000Z'
    sqlite.prepare('INSERT INTO teams(id,name,created_at,updated_at) VALUES (?,?,?,?)')
      .run('team_A', 'Team A', now, now)
    sqlite.prepare('INSERT INTO athlete_groups(id,team_id,category_code,level_code,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run('group_A', 'team_A', 'M', '1', now, now)
    const insertPlan = sqlite.prepare('INSERT INTO group_training_plans(id,group_id,title,status,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    const insertMacro = sqlite.prepare('INSERT INTO macrocycles(id,title,group_training_plan_id,start_date,end_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    const insertMeso = sqlite.prepare('INSERT INTO mesocycles(id,macrocycle_id,title,number,period,objective,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
    const insertMicro = sqlite.prepare('INSERT INTO microcycles(id,mesocycle_id,week_number,type,start_date,end_date,target_volume_km,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    for (let i = 0; i < 24; i++) {
      const id = `plan_${i}`, macro = `macro_${i}`, meso = `meso_${i}`
      insertPlan.run(id, 'group_A', id, 'active', now, now)
      insertMacro.run(macro, macro, id, '2026-11-01', '2026-12-01', now, now)
      insertMeso.run(meso, macro, meso, 1, 'base', 'Objective', now, now)
      insertMicro.run(`micro_${i}`, meso, 1, 'base', '2026-11-02', '2026-11-08', 30, now, now)
    }

    const db = drizzle(sqlite, { schema })
    trace.length = 0
    const plans = await db.query.groupTrainingPlans.findMany({
      where: and(inArray(schema.groupTrainingPlans.groupId, ['group_A']), eq(schema.groupTrainingPlans.isDeleted, false)),
      with: {
        group: true,
        planningCohort: true,
        sourceGroupTrainingPlan: true,
        macrocycles: {
          with: {
            mesocycles: { with: { microcycles: true } },
          },
        },
      },
    })
    const statements = trace.filter((sql) => /^select\\b/i.test(sql.trim()))
    assert.equal(plans.length, 24, 'the current full reader still hydrates all matching plans')
    assert.equal(plans.every((plan) => plan.macrocycles.length === 1 && plan.macrocycles[0]?.mesocycles[0]?.microcycles.length === 1), true)
    assert.ok(statements.length >= 1 && statements.length <= 4,
      `Expected a bounded number of SELECTs independent of Plan count; got ${statements.length}`)
    assert.equal(trace.some((sql) => /^(insert|update|delete)\\b/i.test(sql.trim())), false)
  } finally {
    sqlite.close()
  }
})
