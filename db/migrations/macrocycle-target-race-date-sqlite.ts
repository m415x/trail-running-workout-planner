import type Database from 'better-sqlite3'

interface TableColumn {
  name: string
}

/**
 * Adds the historical target-race date snapshot to existing SQLite databases.
 *
 * The column is nullable so legacy macrocycles remain valid. New H9 planning
 * persistence writes it only when a generation/review explicitly uses a
 * primary competition; calendar edits never synchronize this snapshot.
 *
 * The migration is intentionally idempotent because local development databases
 * can be migrated more than once while switching branches or recreating seeds.
 */
export function migrateMacrocycleTargetRaceDateSqlite(sqlite: Database.Database) {
  const macrocycleColumns = new Set(
    sqlite.prepare('PRAGMA table_info(macrocycles)')
      .all()
      .map((row) => (row as TableColumn).name),
  )

  if (!macrocycleColumns.has('target_race_date')) {
    sqlite.exec(`
      ALTER TABLE macrocycles
      ADD COLUMN target_race_date TEXT
    `)
  }
}
