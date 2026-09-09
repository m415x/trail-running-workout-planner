import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'

import { migratePlanningCohortsSqlite } from '@/db/migrations/planning-cohorts-sqlite'

function createLegacyDatabase() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE teams (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );
    CREATE TABLE users (
      id TEXT PRIMARY KEY
    );
    CREATE TABLE athlete_groups (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id)
    );
    CREATE TABLE athlete_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      team_id TEXT NOT NULL REFERENCES teams(id),
      group_id TEXT REFERENCES athlete_groups(id)
    );
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES athlete_groups(id),
      title TEXT NOT NULL
    );

    INSERT INTO teams (id, created_at) VALUES ('team-1', '2026-09-09T00:00:00.000Z');
    INSERT INTO users (id) VALUES ('user-1'), ('coach-1');
    INSERT INTO athlete_groups (id, team_id) VALUES ('group-1', 'team-1');
    INSERT INTO athlete_profiles (id, user_id, team_id, group_id)
      VALUES ('athlete-1', 'user-1', 'team-1', 'group-1');
    INSERT INTO group_training_plans (id, group_id, title)
      VALUES ('base-plan', 'group-1', 'Base');
  `)

  return sqlite
}

function insertCohort(sqlite: Database.Database, id = 'cohort-1') {
  sqlite.prepare(`
    INSERT INTO planning_cohorts (
      id, created_at, updated_at, team_id, group_id, name, purpose
    ) VALUES (?, '2026-09-09T00:00:00.000Z', '2026-09-09T00:00:00.000Z',
      'team-1', 'group-1', 'Objetivo compartido', 'Carrera principal')
  `).run(id)
}

describe('planning cohort SQLite migration', () => {
  it('is idempotent and preserves existing plans as base plans', () => {
    const sqlite = createLegacyDatabase()

    try {
      migratePlanningCohortsSqlite(sqlite)
      migratePlanningCohortsSqlite(sqlite)

      const columns = sqlite.prepare('PRAGMA table_info(group_training_plans)').all() as Array<{ name: string }>
      assert.ok(columns.some((column) => column.name === 'planning_cohort_id'))
      assert.ok(columns.some((column) => column.name === 'source_group_training_plan_id'))

      const basePlan = sqlite.prepare(`
        SELECT planning_cohort_id AS planningCohortId,
               source_group_training_plan_id AS sourceGroupTrainingPlanId
        FROM group_training_plans
        WHERE id = 'base-plan'
      `).get()

      assert.deepEqual(basePlan, {
        planningCohortId: null,
        sourceGroupTrainingPlanId: null,
      })
    } finally {
      sqlite.close()
    }
  })

  it('enforces cohort lifecycle and membership constraints', () => {
    const sqlite = createLegacyDatabase()

    try {
      migratePlanningCohortsSqlite(sqlite)
      insertCohort(sqlite)

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO planning_cohorts (
            id, created_at, updated_at, team_id, group_id, name, purpose, status
          ) VALUES (
            'invalid', '2026-09-09T00:00:00.000Z', '2026-09-09T00:00:00.000Z',
            'team-1', 'group-1', 'Invalid', 'Invalid', 'paused'
          )
        `).run()
      }, /planning_cohorts_status_check/)

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO planning_cohort_memberships (
            id, created_at, updated_at, planning_cohort_id, athlete_profile_id,
            start_date, end_date
          ) VALUES (
            'membership-invalid-dates', '2026-09-09T00:00:00.000Z',
            '2026-09-09T00:00:00.000Z', 'cohort-1', 'athlete-1',
            '2026-09-10', '2026-09-09'
          )
        `).run()
      }, /planning_cohort_memberships_date_order_check/)

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO planning_cohort_memberships (
            id, created_at, updated_at, planning_cohort_id, athlete_profile_id,
            start_date, end_reason
          ) VALUES (
            'membership-invalid-open', '2026-09-09T00:00:00.000Z',
            '2026-09-09T00:00:00.000Z', 'cohort-1', 'athlete-1',
            '2026-09-09', 'No corresponde'
          )
        `).run()
      }, /planning_cohort_memberships_open_end_metadata_check/)
    } finally {
      sqlite.close()
    }
  })

  it('enforces complete, non-self-referencing, unique plan associations', () => {
    const sqlite = createLegacyDatabase()

    try {
      migratePlanningCohortsSqlite(sqlite)
      insertCohort(sqlite)

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO group_training_plans (
            id, group_id, title, planning_cohort_id
          ) VALUES ('partial-variant', 'group-1', 'Partial', 'cohort-1')
        `).run()
      }, /invalid planning cohort plan association/)

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO group_training_plans (
            id, group_id, title, planning_cohort_id, source_group_training_plan_id
          ) VALUES ('self', 'group-1', 'Self', 'cohort-1', 'self')
        `).run()
      }, /invalid planning cohort plan association/)

      sqlite.prepare(`
        INSERT INTO group_training_plans (
          id, group_id, title, planning_cohort_id, source_group_training_plan_id
        ) VALUES ('variant-1', 'group-1', 'Variant', 'cohort-1', 'base-plan')
      `).run()

      assert.throws(() => {
        sqlite.prepare(`
          INSERT INTO group_training_plans (
            id, group_id, title, planning_cohort_id, source_group_training_plan_id
          ) VALUES ('variant-2', 'group-1', 'Duplicate', 'cohort-1', 'base-plan')
        `).run()
      }, /UNIQUE constraint failed/)
    } finally {
      sqlite.close()
    }
  })
})
