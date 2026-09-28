import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as coreSchema from '@/db/schema'
import * as loadSchema from '@/db/load-strategy-schema'
import * as intensitySchema from '@/db/intensity-strategy-schema'
import * as preferencesSchema from '@/db/session-generation-preferences-schema'
import * as competitionSchema from '@/db/competition-entry-schema'
import { persistPlanningCohortVariantSynchronously } from '@/lib/planning-cohorts/variant-persistence'

function createAggregateFixture() {
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
      status TEXT NOT NULL DEFAULT 'active'
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
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      UNIQUE(planning_cohort_id)
    );
    CREATE TABLE macrocycles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT NOT NULL,
      group_training_plan_id TEXT NOT NULL REFERENCES group_training_plans(id),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      tapering_weeks_count INTEGER,
      target_race_name TEXT,
      target_race_date TEXT,
      target_race_distance_km REAL,
      target_race_elevation_gain INTEGER,
      notes TEXT
    );
    CREATE TABLE mesocycles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      macrocycle_id TEXT NOT NULL REFERENCES macrocycles(id),
      title TEXT NOT NULL,
      number INTEGER NOT NULL,
      period TEXT NOT NULL,
      objective TEXT NOT NULL
    );
    CREATE TABLE microcycles (
      id TEXT PRIMARY KEY,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      mesocycle_id TEXT NOT NULL REFERENCES mesocycles(id),
      week_number INTEGER NOT NULL,
      type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      target_volume_km REAL,
      target_volume_source TEXT NOT NULL,
      target_elevation_gain INTEGER,
      target_elevation_source TEXT NOT NULL,
      target_duration_min INTEGER,
      notes TEXT
    );
    CREATE TABLE load_strategies (
      id TEXT PRIMARY KEY,
      group_training_plan_id TEXT NOT NULL REFERENCES group_training_plans(id),
      goal_type TEXT NOT NULL,
      initial_weekly_volume_km REAL NOT NULL,
      maximum_weekly_volume_km REAL NOT NULL,
      maximum_weekly_increase_percentage REAL NOT NULL,
      deload_percentage REAL NOT NULL,
      initial_weekly_elevation_gain INTEGER,
      maximum_weekly_elevation_gain INTEGER,
      field_sources TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(group_training_plan_id)
    );
    CREATE TABLE intensity_strategies (
      id TEXT PRIMARY KEY,
      group_training_plan_id TEXT NOT NULL REFERENCES group_training_plans(id),
      goal_type TEXT NOT NULL,
      default_method TEXT NOT NULL,
      maximum_intense_sessions_per_week INTEGER NOT NULL,
      minimum_recovery_days_between_intense_sessions INTEGER NOT NULL,
      field_sources TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(group_training_plan_id)
    );
    CREATE TABLE session_generation_preferences (
      id TEXT PRIMARY KEY,
      group_training_plan_id TEXT NOT NULL REFERENCES group_training_plans(id),
      frequency_mode TEXT NOT NULL,
      fixed_sessions_per_week INTEGER,
      weekly_pattern TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(group_training_plan_id)
    );
    CREATE TABLE microcycle_intensity_targets (
      id TEXT PRIMARY KEY,
      microcycle_id TEXT NOT NULL REFERENCES microcycles(id),
      emphasis TEXT NOT NULL,
      intense_sessions_target INTEGER NOT NULL,
      predominant_zone TEXT NOT NULL,
      reference_percentage_target REAL,
      minimum_recovery_days_between_intense_sessions INTEGER NOT NULL,
      field_sources TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(microcycle_id)
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
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      date TEXT NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL
    );
    CREATE TABLE group_session_prescriptions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      microcycle_id TEXT NOT NULL REFERENCES microcycles(id)
    );
  `)

  const now = '2026-09-01T00:00:00.000Z'
  sqlite.prepare(`INSERT INTO teams VALUES ('team-1','Team 1',0,?,?)`).run(now,now)
  sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,description,is_active)
    VALUES ('group-1',0,?,?,'M','1','team-1',NULL,1)
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO planning_cohorts
    (id,is_deleted,created_at,updated_at,team_id,group_id,name,purpose,description,status)
    VALUES ('cohort-1',0,?,?,'team-1','group-1','42K','Carrera',NULL,'active')
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO group_training_plans
    (id,is_deleted,created_at,updated_at,group_id,planning_cohort_id,source_group_training_plan_id,title,status,notes)
    VALUES ('base-1',0,?,?,'group-1',NULL,NULL,'Base M1','active','Notas base')
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO macrocycles
    VALUES ('macro-1',0,?,?,'Macro','base-1','2026-09-01','2026-12-20',2,'Race','2026-12-20',42,1800,'Macro notes')
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO mesocycles
    VALUES ('meso-1',0,?,?,'macro-1','Meso',1,'specific_preparatory','Objetivo')
  `).run(now,now)
  sqlite.prepare(`
    INSERT INTO microcycles
    VALUES ('micro-1',0,?,?,'meso-1',1,'development','2026-09-07','2026-09-13',52,'manual',2100,'generated',360,'Micro notes')
  `).run(now,now)

  sqlite.prepare(`
    INSERT INTO load_strategies VALUES
    ('load-1','base-1','race',38,70,10,25,900,2800,?,0,?,?)
  `).run(JSON.stringify({
    initialWeeklyVolumeKm:'suggested',
    maximumWeeklyVolumeKm:'manual',
    maximumWeeklyIncreasePercentage:'suggested',
    deloadPercentage:'manual',
    initialWeeklyElevationGain:'suggested',
    maximumWeeklyElevationGain:'manual',
  }),now,now)

  sqlite.prepare(`
    INSERT INTO intensity_strategies VALUES
    ('intensity-1','base-1','race','hr_zone',2,2,?,0,?,?)
  `).run(JSON.stringify({
    defaultMethod:'suggested',
    maximumIntenseSessionsPerWeek:'manual',
    minimumRecoveryDaysBetweenIntenseSessions:'suggested',
  }),now,now)

  sqlite.prepare(`
    INSERT INTO session_generation_preferences VALUES
    ('preferences-1','base-1','fixed',4,?,0,?,?)
  `).run(JSON.stringify([
    { weekday:2, role:'quality' },
    { weekday:4, role:'easy' },
    { weekday:6, role:'long' },
    { weekday:7, role:'easy' },
  ]),now,now)

  sqlite.prepare(`
    INSERT INTO microcycle_intensity_targets VALUES
    ('target-1','micro-1','threshold',1,'Z2',90,2,?,0,?,?)
  `).run(JSON.stringify({
    intenseSessionsTarget:'manual',
    predominantZone:'generated',
    referencePercentageTarget:'manual',
    minimumRecoveryDaysBetweenIntenseSessions:'generated',
  }),now,now)

  sqlite.prepare(`
    INSERT INTO competition_entries VALUES
    ('competition-1','base-1','Trail 42K','2026-12-20',42,1800,'A','confirmed','Principal',0,?,?)
  `).run(now,now)

  sqlite.prepare(`
    INSERT INTO sessions VALUES ('session-1','team-1','2026-09-09','Trail técnico','Trail')
  `).run()
  sqlite.prepare(`
    INSERT INTO group_session_prescriptions VALUES ('prescription-1','session-1','group-1','micro-1')
  `).run()

  return {
    sqlite,
    db: drizzle(sqlite, {
      schema: {
        ...coreSchema,
        ...loadSchema,
        ...intensitySchema,
        ...preferencesSchema,
        ...competitionSchema,
      },
    }),
  }
}

function ids() {
  let index = 0
  return () => `derived-${++index}`
}

describe('KAN-517 complete planning variant persistence', () => {
  it('rolls back the entire derived aggregate when a child insert fails', () => {
    const fixture = createAggregateFixture()

    try {
      const createDuplicateChildId = (() => {
        let index = 0
        return () => {
          index += 1
          if (index === 2) return 'load-1'
          return `rollback-${index}`
        }
      })()

      assert.throws(() => persistPlanningCohortVariantSynchronously({
        db: fixture.db,
        teamId: 'team-1',
        cohortId: 'cohort-1',
        sourcePlanId: 'base-1',
        title: 'Variante rollback',
        selectedCompetitionEntryIds: ['competition-1'],
        createId: createDuplicateChildId,
        now: () => '2026-09-28T15:00:00.000Z',
      }))

      const variantPlans = fixture.sqlite.prepare(`
        SELECT count(*) AS count
        FROM group_training_plans
        WHERE planning_cohort_id = 'cohort-1'
      `).get() as { count:number }

      const derivedMacros = fixture.sqlite.prepare(`
        SELECT count(*) AS count
        FROM macrocycles
        WHERE group_training_plan_id <> 'base-1'
      `).get() as { count:number }

      const derivedCompetitions = fixture.sqlite.prepare(`
        SELECT count(*) AS count
        FROM competition_entries
        WHERE group_training_plan_id <> 'base-1'
      `).get() as { count:number }

      assert.equal(variantPlans.count,0)
      assert.equal(derivedMacros.count,0)
      assert.equal(derivedCompetitions.count,0)
    } finally {
      fixture.sqlite.close()
    }
  })

  it('persists an independent planning snapshot and only selected competitions', () => {
    const fixture = createAggregateFixture()

    try {
      const result = persistPlanningCohortVariantSynchronously({
        db: fixture.db,
        teamId: 'team-1',
        cohortId: 'cohort-1',
        sourcePlanId: 'base-1',
        title: 'Variante 42K',
        selectedCompetitionEntryIds: ['competition-1'],
        createId: ids(),
        now: () => '2026-09-28T15:00:00.000Z',
      })

      const ownerCounts = {
        load: fixture.sqlite.prepare(
          'SELECT count(*) AS count FROM load_strategies WHERE group_training_plan_id = ?'
        ).get(result.planId) as { count:number },
        intensity: fixture.sqlite.prepare(
          'SELECT count(*) AS count FROM intensity_strategies WHERE group_training_plan_id = ?'
        ).get(result.planId) as { count:number },
        preferences: fixture.sqlite.prepare(
          'SELECT count(*) AS count FROM session_generation_preferences WHERE group_training_plan_id = ?'
        ).get(result.planId) as { count:number },
        macro: fixture.sqlite.prepare(
          'SELECT count(*) AS count FROM macrocycles WHERE group_training_plan_id = ?'
        ).get(result.planId) as { count:number },
        competition: fixture.sqlite.prepare(
          'SELECT count(*) AS count FROM competition_entries WHERE group_training_plan_id = ?'
        ).get(result.planId) as { count:number },
      }

      assert.deepEqual(Object.fromEntries(
        Object.entries(ownerCounts).map(([key,value]) => [key,value.count])
      ), {
        load:1,
        intensity:1,
        preferences:1,
        macro:1,
        competition:1,
      })

      const derivedMacro = fixture.sqlite.prepare(
        'SELECT id, target_race_date AS targetRaceDate FROM macrocycles WHERE group_training_plan_id = ?'
      ).get(result.planId) as { id:string; targetRaceDate:string|null }
      const derivedMeso = fixture.sqlite.prepare(
        'SELECT id FROM mesocycles WHERE macrocycle_id = ?'
      ).get(derivedMacro.id) as { id:string }
      const derivedMicro = fixture.sqlite.prepare(
        'SELECT id FROM microcycles WHERE mesocycle_id = ?'
      ).get(derivedMeso.id) as { id:string }
      const derivedTarget = fixture.sqlite.prepare(
        'SELECT id, microcycle_id AS microcycleId FROM microcycle_intensity_targets WHERE microcycle_id = ?'
      ).get(derivedMicro.id) as { id:string; microcycleId:string }

      assert.notEqual(derivedMacro.id,'macro-1')
      assert.notEqual(derivedMeso.id,'meso-1')
      assert.notEqual(derivedMicro.id,'micro-1')
      assert.notEqual(derivedTarget.id,'target-1')
      assert.equal(derivedTarget.microcycleId,derivedMicro.id)
      assert.equal(derivedMacro.targetRaceDate,'2026-12-20')

      const competition = fixture.sqlite.prepare(`
        SELECT id, group_training_plan_id AS groupTrainingPlanId, name, priority
        FROM competition_entries
        WHERE group_training_plan_id = ?
      `).get(result.planId) as {
        id:string
        groupTrainingPlanId:string
        name:string
        priority:string
      }
      assert.notEqual(competition.id,'competition-1')
      assert.equal(competition.groupTrainingPlanId,result.planId)
      assert.equal(competition.name,'Trail 42K')
      assert.equal(competition.priority,'A')

      assert.equal(
        (fixture.sqlite.prepare('SELECT count(*) AS count FROM sessions').get() as { count:number }).count,
        1,
      )
      assert.equal(
        (fixture.sqlite.prepare('SELECT count(*) AS count FROM group_session_prescriptions').get() as { count:number }).count,
        1,
      )
    } finally {
      fixture.sqlite.close()
    }
  })
})
