import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as coreSchema from '@/db/schema'
import * as competitionSchema from '@/db/competition-entry-schema'
import * as raceCatalogSchema from '@/db/race-catalog-schema'
import {
  loadRaceCoursePlanningImpactSynchronously,
} from '@/lib/race-catalog/planning-impact-query'

function createFixture() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE athlete_groups (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      category_code TEXT NOT NULL,
      level_code TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id),
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE planning_cohorts (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id),
      group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      name TEXT NOT NULL,
      purpose TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      planning_cohort_id TEXT REFERENCES planning_cohorts(id),
      source_group_training_plan_id TEXT REFERENCES group_training_plans(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT
    );
    CREATE TABLE competition_entries (
      id TEXT PRIMARY KEY,
      group_training_plan_id TEXT NOT NULL REFERENCES group_training_plans(id),
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      distance_km REAL NOT NULL,
      elevation_gain_m REAL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      description TEXT,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE race_courses (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE competition_entry_race_courses (
      competition_entry_id TEXT PRIMARY KEY REFERENCES competition_entries(id) ON DELETE CASCADE,
      race_course_id TEXT NOT NULL REFERENCES race_courses(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );
  `)

  const now='2026-09-28T00:00:00.000Z'
  sqlite.prepare(`INSERT INTO teams VALUES ('team-1','Team 1',0,?,?)`).run(now,now)
  sqlite.prepare(`INSERT INTO teams VALUES ('team-2','Team 2',0,?,?)`).run(now,now)

  sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,description,is_active)
    VALUES ('group-s2',0,?,?,'S','2','team-1',NULL,1)
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,description,is_active)
    VALUES ('group-m1',0,?,?,'M','1','team-1',NULL,1)
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,description,is_active)
    VALUES ('group-x1',0,?,?,'M','1','team-2',NULL,1)
  `).run(now,now)

  sqlite.prepare(`
    INSERT INTO planning_cohorts
    VALUES ('cohort-s2',0,?,?,'team-1','group-s2','Short Trail primavera','Objetivo',NULL,'active')
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO planning_cohorts
    VALUES ('cohort-m1',0,?,?,'team-1','group-m1','Maratón montaña','Objetivo',NULL,'active')
  `).run(now,now)

  const insertPlan=sqlite.prepare(`
    INSERT INTO group_training_plans
    (id,is_deleted,created_at,updated_at,group_id,planning_cohort_id,source_group_training_plan_id,title,status,notes)
    VALUES (?,0,?,?,?,?,?,?,?,NULL)
  `)
  insertPlan.run('base-s2',now,now,'group-s2',null,null,'Plan base S2','active')
  insertPlan.run('base-m1',now,now,'group-m1',null,null,'Plan base M1','active')
  insertPlan.run('variant-s2',now,now,'group-s2','cohort-s2','base-s2','Short Trail primavera · Variante','draft')
  insertPlan.run('variant-m1',now,now,'group-m1','cohort-m1','base-m1','Maratón montaña · Variante','draft')
  insertPlan.run('foreign-plan',now,now,'group-x1',null,null,'Foreign','active')

  sqlite.prepare(`INSERT INTO race_courses VALUES ('course-42')`).run()
  sqlite.prepare(`INSERT INTO race_courses VALUES ('course-other')`).run()

  const insertEntry=sqlite.prepare(`
    INSERT INTO competition_entries
    VALUES (?,?,?,?,?,?,?,?,?,0,?,?)
  `)
  insertEntry.run('entry-base','base-s2','Patagonia Run', '2026-11-16',42,2200,'A','confirmed',null,now,now)
  insertEntry.run('entry-s2','variant-s2','Patagonia Run', '2026-11-16',42,2200,'A','confirmed',null,now,now)
  insertEntry.run('entry-m1','variant-m1','Patagonia Run', '2026-11-16',42,2200,'B','planned',null,now,now)
  insertEntry.run('lookalike','base-s2','Patagonia Run', '2026-11-16',42,2200,'A','confirmed',null,now,now)
  insertEntry.run('foreign-entry','foreign-plan','Patagonia Run', '2026-11-16',42,2200,'A','confirmed',null,now,now)

  const link=sqlite.prepare(`
    INSERT INTO competition_entry_race_courses VALUES (?,?,?)
  `)
  link.run('entry-base','course-42',now)
  link.run('entry-s2','course-42',now)
  link.run('entry-m1','course-42',now)
  link.run('lookalike','course-other',now)
  link.run('foreign-entry','course-42',now)

  return {
    sqlite,
    db: drizzle(sqlite, {
      schema: {
        ...coreSchema,
        ...competitionSchema,
        ...raceCatalogSchema,
      },
    }),
  }
}

describe('KAN-519 race course planning impact query', () => {
  it('loads only persisted links for the requested team and race course', () => {
    const fixture=createFixture()

    try {
      const result=loadRaceCoursePlanningImpactSynchronously({
        db: fixture.db,
        teamId:'team-1',
        raceCourseId:'course-42',
      })

      assert.deepEqual(result.map((item) => ({
        competitionEntryId:item.competitionEntryId,
        planId:item.planId,
        groupCode:item.groupCode,
        planningCohortId:item.planningCohortId,
      })), [
        {
          competitionEntryId:'entry-m1',
          planId:'variant-m1',
          groupCode:'M1',
          planningCohortId:'cohort-m1',
        },
        {
          competitionEntryId:'entry-base',
          planId:'base-s2',
          groupCode:'S2',
          planningCohortId:null,
        },
        {
          competitionEntryId:'entry-s2',
          planId:'variant-s2',
          groupCode:'S2',
          planningCohortId:'cohort-s2',
        },
      ])
    } finally {
      fixture.sqlite.close()
    }
  })
})
