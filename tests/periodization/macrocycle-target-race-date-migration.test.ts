import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import Database from 'better-sqlite3'

import { migrateMacrocycleTargetRaceDateSqlite } from '@/db/migrations/macrocycle-target-race-date-sqlite'

interface TableColumn {
  name: string
}

let sqlite: Database.Database

describe('migración SQLite de targetRaceDate', () => {
  beforeEach(() => {
    sqlite = new Database(':memory:')
    sqlite.exec(`
      CREATE TABLE macrocycles (
        id TEXT PRIMARY KEY NOT NULL,
        target_race_name TEXT,
        target_race_distance_km REAL,
        target_race_elevation_gain INTEGER
      );

      INSERT INTO macrocycles (
        id,
        target_race_name,
        target_race_distance_km,
        target_race_elevation_gain
      ) VALUES ('macro-legacy', 'Carrera histórica', 42, 1500);
    `)
  })

  afterEach(() => sqlite.close())

  it('agrega la columna nullable sin alterar snapshots legacy', () => {
    migrateMacrocycleTargetRaceDateSqlite(sqlite)

    const columns = sqlite.prepare('PRAGMA table_info(macrocycles)')
      .all()
      .map((row) => (row as TableColumn).name)
    const saved = sqlite.prepare(`
      SELECT
        target_race_name AS targetRaceName,
        target_race_date AS targetRaceDate,
        target_race_distance_km AS targetRaceDistanceKm,
        target_race_elevation_gain AS targetRaceElevationGain
      FROM macrocycles
      WHERE id = 'macro-legacy'
    `).get() as {
      targetRaceName: string
      targetRaceDate: string | null
      targetRaceDistanceKm: number
      targetRaceElevationGain: number
    }

    assert.equal(columns.includes('target_race_date'), true)
    assert.equal(saved.targetRaceName, 'Carrera histórica')
    assert.equal(saved.targetRaceDate, null)
    assert.equal(saved.targetRaceDistanceKm, 42)
    assert.equal(saved.targetRaceElevationGain, 1500)
  })

  it('es idempotente', () => {
    migrateMacrocycleTargetRaceDateSqlite(sqlite)
    migrateMacrocycleTargetRaceDateSqlite(sqlite)

    const matchingColumns = sqlite.prepare('PRAGMA table_info(macrocycles)')
      .all()
      .map((row) => (row as TableColumn).name)
      .filter((name) => name === 'target_race_date')

    assert.deepEqual(matchingColumns, ['target_race_date'])
  })
})
