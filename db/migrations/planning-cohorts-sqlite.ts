import type Database from 'better-sqlite3'

interface TableColumn {
  name: string
}

/**
 * Adds planning-cohort persistence to an existing SQLite database.
 *
 * The migration is idempotent and preserves existing group plans as base plans
 * by leaving both new association columns null. Cross-table team, group, and
 * interval-overlap rules remain application-level transactional invariants.
 */
export function migratePlanningCohortsSqlite(sqlite: Database.Database) {
  sqlite.pragma('foreign_keys = ON')

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS planning_cohorts (
        id TEXT PRIMARY KEY NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL REFERENCES athlete_groups(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        CONSTRAINT planning_cohorts_status_check
          CHECK (status IN ('active', 'archived'))
      );

      CREATE INDEX IF NOT EXISTS planning_cohorts_team_group_status_idx
        ON planning_cohorts(team_id, group_id, status);

      CREATE TABLE IF NOT EXISTS planning_cohort_memberships (
        id TEXT PRIMARY KEY NOT NULL,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        planning_cohort_id TEXT NOT NULL
          REFERENCES planning_cohorts(id) ON DELETE CASCADE,
        athlete_profile_id TEXT NOT NULL
          REFERENCES athlete_profiles(id) ON DELETE CASCADE,
        start_date TEXT NOT NULL,
        end_date TEXT,
        assigned_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        assignment_reason TEXT,
        ended_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        end_reason TEXT,
        CONSTRAINT planning_cohort_memberships_date_order_check
          CHECK (end_date IS NULL OR end_date >= start_date),
        CONSTRAINT planning_cohort_memberships_open_end_metadata_check
          CHECK (end_date IS NOT NULL OR (ended_by_user_id IS NULL AND end_reason IS NULL))
      );

      CREATE INDEX IF NOT EXISTS planning_cohort_memberships_cohort_dates_idx
        ON planning_cohort_memberships(planning_cohort_id, start_date, end_date);

      CREATE INDEX IF NOT EXISTS planning_cohort_memberships_athlete_dates_idx
        ON planning_cohort_memberships(athlete_profile_id, start_date, end_date);
    `)

    const planColumns = new Set(
      sqlite.prepare('PRAGMA table_info(group_training_plans)')
        .all()
        .map((row) => (row as TableColumn).name),
    )

    if (!planColumns.has('planning_cohort_id')) {
      sqlite.exec(`
        ALTER TABLE group_training_plans
        ADD COLUMN planning_cohort_id TEXT
          REFERENCES planning_cohorts(id) ON DELETE RESTRICT
      `)
    }

    if (!planColumns.has('source_group_training_plan_id')) {
      sqlite.exec(`
        ALTER TABLE group_training_plans
        ADD COLUMN source_group_training_plan_id TEXT
          REFERENCES group_training_plans(id) ON DELETE RESTRICT
      `)
    }

    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS group_training_plans_planning_cohort_unique
        ON group_training_plans(planning_cohort_id);

      CREATE INDEX IF NOT EXISTS group_training_plans_source_idx
        ON group_training_plans(source_group_training_plan_id);

      CREATE TRIGGER IF NOT EXISTS group_training_plans_cohort_source_insert_check
      BEFORE INSERT ON group_training_plans
      WHEN
        (NEW.planning_cohort_id IS NULL) <> (NEW.source_group_training_plan_id IS NULL)
        OR NEW.source_group_training_plan_id = NEW.id
      BEGIN
        SELECT RAISE(ABORT, 'invalid planning cohort plan association');
      END;

      CREATE TRIGGER IF NOT EXISTS group_training_plans_cohort_source_update_check
      BEFORE UPDATE OF planning_cohort_id, source_group_training_plan_id, id
      ON group_training_plans
      WHEN
        (NEW.planning_cohort_id IS NULL) <> (NEW.source_group_training_plan_id IS NULL)
        OR NEW.source_group_training_plan_id = NEW.id
      BEGIN
        SELECT RAISE(ABORT, 'invalid planning cohort plan association');
      END;
    `)
  })()
}
