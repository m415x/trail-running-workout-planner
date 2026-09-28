import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as coreSchema from '@/db/schema'
import {
  persistPlanningCohortVariantSynchronously,
  PlanningVariantPersistenceError,
} from '@/lib/planning-cohorts/variant-persistence'

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
  `)

  const now = '2026-09-28T00:00:00.000Z'
  const insertTeam = sqlite.prepare(`
    INSERT INTO teams (id,name,is_deleted,created_at,updated_at)
    VALUES (?, ?, 0, ?, ?)
  `)
  insertTeam.run('team-1','Team 1',now,now)
  insertTeam.run('team-2','Team 2',now,now)

  const insertGroup = sqlite.prepare(`
    INSERT INTO athlete_groups
    (id,is_deleted,created_at,updated_at,category_code,level_code,team_id,is_active)
    VALUES (?,0,?,?,'M','1',?,1)
  `)
  insertGroup.run('group-1',now,now,'team-1')
  insertGroup.run('group-2',now,now,'team-2')

  const insertCohort = sqlite.prepare(`
    INSERT INTO planning_cohorts
    (id,is_deleted,created_at,updated_at,team_id,group_id,name,purpose,status)
    VALUES (?,0,?,?,?,?,?,?,?)
  `)
  insertCohort.run('cohort-1',now,now,'team-1','group-1','Objetivo 42K','Carrera principal','active')
  insertCohort.run('cohort-archived',now,now,'team-1','group-1','Archivado','Histórico','archived')
  insertCohort.run('cohort-foreign',now,now,'team-2','group-2','Otro team','Otro','active')

  const insertPlan = sqlite.prepare(`
    INSERT INTO group_training_plans
    (id,is_deleted,created_at,updated_at,group_id,planning_cohort_id,source_group_training_plan_id,title,status,notes)
    VALUES (?,0,?,?,?,?,?,?,?,?)
  `)
  insertPlan.run('base-1',now,now,'group-1',null,null,'Base M1','active','Base')
  insertPlan.run('base-2',now,now,'group-2',null,null,'Base foreign','active',null)
  insertPlan.run('existing-variant',now,now,'group-1','cohort-archived','base-1','Existing variant','draft',null)

  return {
    sqlite,
    db: drizzle(sqlite, { schema: coreSchema }),
  }
}

function ids() {
  let index = 0
  return () => `variant-${++index}`
}

describe('KAN-517 planning cohort variant persistence', () => {
  it('persists one draft variant linked directly to its active cohort and base plan', () => {
    const fixture = createFixture()

    try {
      const result = persistPlanningCohortVariantSynchronously({
        db: fixture.db,
        teamId: 'team-1',
        cohortId: 'cohort-1',
        sourcePlanId: 'base-1',
        title: 'Variante 42K',
        selectedCompetitionEntryIds: [],
        createId: ids(),
        now: () => '2026-09-28T15:00:00.000Z',
      })

      assert.deepEqual(result, {
        planId: 'variant-1',
        cohortId: 'cohort-1',
        sourcePlanId: 'base-1',
      })

      const row = fixture.sqlite.prepare(`
        SELECT
          id,
          group_id AS groupId,
          planning_cohort_id AS planningCohortId,
          source_group_training_plan_id AS sourceGroupTrainingPlanId,
          title,
          status,
          notes
        FROM group_training_plans
        WHERE id = 'variant-1'
      `).get()

      assert.deepEqual(row, {
        id: 'variant-1',
        groupId: 'group-1',
        planningCohortId: 'cohort-1',
        sourceGroupTrainingPlanId: 'base-1',
        title: 'Variante 42K',
        status: 'draft',
        notes: 'Base',
      })
    } finally {
      fixture.sqlite.close()
    }
  })

  it('rejects archived, cross-team and variant-as-source scopes without writing', () => {
    const cases = [
      { cohortId: 'cohort-archived', sourcePlanId: 'base-1' },
      { cohortId: 'cohort-foreign', sourcePlanId: 'base-1' },
      { cohortId: 'cohort-1', sourcePlanId: 'existing-variant' },
    ] as const

    for (const scenario of cases) {
      const fixture = createFixture()
      try {
        assert.throws(
          () => persistPlanningCohortVariantSynchronously({
            db: fixture.db,
            teamId: 'team-1',
            cohortId: scenario.cohortId,
            sourcePlanId: scenario.sourcePlanId,
            title: 'Inválida',
            selectedCompetitionEntryIds: [],
            createId: ids(),
            now: () => '2026-09-28T15:00:00.000Z',
          }),
          PlanningVariantPersistenceError,
        )

        const count = fixture.sqlite.prepare(`
          SELECT count(*) AS count
          FROM group_training_plans
          WHERE planning_cohort_id = 'cohort-1'
        `).get() as { count: number }

        assert.equal(count.count, 0)
      } finally {
        fixture.sqlite.close()
      }
    }
  })
})
