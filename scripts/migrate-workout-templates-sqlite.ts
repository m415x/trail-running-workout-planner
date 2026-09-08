import Database from 'better-sqlite3'

interface TableColumn {
  name: string
}

interface CountRow {
  count: number
}

/**
 * Backfills required workout-template ownership and catalogue fields before
 * Drizzle rebuilds the SQLite table with its final not-null constraints.
 *
 * The migration is idempotent so another local checkout can run it safely
 * before pnpm db:push without deleting its existing workout catalogue.
 */
function migrateWorkoutTemplates() {
  const sqlite = new Database('sqlite.db')

  try {
    const columns = new Set(
      sqlite.prepare('PRAGMA table_info(workouts)')
        .all()
        .map((row) => (row as TableColumn).name),
    )

    sqlite.transaction(() => {
      if (!columns.has('team_id')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN team_id TEXT REFERENCES teams(id)')
      }
      if (!columns.has('category')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN category TEXT')
      }
      if (!columns.has('tags')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN tags TEXT')
      }
      if (!columns.has('archived_at')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN archived_at TEXT')
      }
      if (!columns.has('intensity_method')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN intensity_method TEXT')
      }
      if (!columns.has('pam_percentage')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN pam_percentage REAL')
      }
      if (!columns.has('prescription_notes')) {
        sqlite.exec('ALTER TABLE workouts ADD COLUMN prescription_notes TEXT')
      }

      sqlite.exec(`
        UPDATE workouts
        SET
          team_id = COALESCE(
            team_id,
            (
              SELECT sessions.team_id
              FROM sessions
              WHERE sessions.workout_id = workouts.id
              LIMIT 1
            ),
            (SELECT teams.id FROM teams ORDER BY teams.created_at LIMIT 1)
          ),
          category = COALESCE(
            category,
            CASE
              WHEN type = 'Race' THEN 'competition'
              WHEN type IN ('Trail', 'Hills') THEN 'mountain'
              WHEN type IN ('Intervals', 'Speed', 'Fartlek', 'PAM') THEN 'quality'
              WHEN type = 'Rest' THEN 'recovery'
              ELSE 'endurance'
            END
          ),
          tags = COALESCE(tags, '[]'),
          intensity_method = COALESCE(
            intensity_method,
            CASE WHEN zone IS NULL THEN NULL ELSE 'hr_zone' END
          ),
          prescription_notes = COALESCE(prescription_notes, notes)
      `)

      const missingRequiredValues = sqlite.prepare(`
        SELECT COUNT(*) AS count
        FROM workouts
        WHERE team_id IS NULL OR category IS NULL OR tags IS NULL
      `).get() as CountRow

      if (missingRequiredValues.count > 0) {
        throw new Error(
          'No se pudieron asignar los campos requeridos a todas las plantillas.',
        )
      }
    })()
  } finally {
    sqlite.close()
  }
}

migrateWorkoutTemplates()
