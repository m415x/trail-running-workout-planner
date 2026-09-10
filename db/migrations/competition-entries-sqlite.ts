import type Database from 'better-sqlite3'

/**
 * Adds CompetitionEntry persistence to an existing SQLite database.
 *
 * The migration is idempotent and intentionally enforces only structural
 * invariants. Audience ownership, active-calendar filtering and the single-A
 * rule inside one macrocycle context remain application-level domain policies.
 */
export function migrateCompetitionEntriesSqlite(sqlite: Database.Database) {
  sqlite.pragma('foreign_keys = ON')

  sqlite.transaction(() => {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS competition_entries (
        id TEXT PRIMARY KEY NOT NULL,
        group_training_plan_id TEXT NOT NULL
          REFERENCES group_training_plans(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        distance_km REAL NOT NULL,
        elevation_gain_m REAL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        description TEXT,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CONSTRAINT competition_entries_name_check
          CHECK (length(trim(name)) > 0),
        CONSTRAINT competition_entries_distance_check
          CHECK (distance_km > 0),
        CONSTRAINT competition_entries_elevation_gain_check
          CHECK (elevation_gain_m IS NULL OR elevation_gain_m >= 0),
        CONSTRAINT competition_entries_priority_check
          CHECK (priority IN ('A', 'B', 'C')),
        CONSTRAINT competition_entries_status_check
          CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled'))
      );

      CREATE INDEX IF NOT EXISTS competition_entries_plan_date_idx
        ON competition_entries(group_training_plan_id, date);

      CREATE INDEX IF NOT EXISTS competition_entries_plan_status_date_idx
        ON competition_entries(group_training_plan_id, status, date);
    `)
  })()
}
