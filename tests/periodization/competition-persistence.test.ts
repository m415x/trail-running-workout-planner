import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import Database from 'better-sqlite3'

import { migrateCompetitionEntriesSqlite } from '@/db/migrations/competition-entries-sqlite'

function databaseWithPlan() {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE group_training_plans (
      id TEXT PRIMARY KEY NOT NULL
    );
    INSERT INTO group_training_plans (id) VALUES ('plan-1');
  `)
  return sqlite
}

function insertCompetition(sqlite: Database.Database, overrides = '') {
  sqlite.exec(`
    INSERT INTO competition_entries (
      id,
      group_training_plan_id,
      name,
      date,
      distance_km,
      elevation_gain_m,
      priority,
      status,
      description,
      created_at,
      updated_at
    ) VALUES (
      'competition-1',
      'plan-1',
      'Patagonia Run 42K',
      '2027-04-10',
      42,
      2200,
      'A',
      'confirmed',
      NULL,
      '2026-09-10T00:00:00.000Z',
      '2026-09-10T00:00:00.000Z'
    )${overrides};
  `)
}

describe('competition entry SQLite persistence', () => {
  it('creates the migration idempotently and persists a valid competition', () => {
    const sqlite = databaseWithPlan()

    try {
      migrateCompetitionEntriesSqlite(sqlite)
      migrateCompetitionEntriesSqlite(sqlite)
      insertCompetition(sqlite)

      const row = sqlite.prepare(`
        SELECT
          group_training_plan_id AS groupTrainingPlanId,
          distance_km AS distanceKm,
          elevation_gain_m AS elevationGainM,
          priority,
          status
        FROM competition_entries
        WHERE id = 'competition-1'
      `).get()

      assert.deepEqual(row, {
        groupTrainingPlanId: 'plan-1',
        distanceKm: 42,
        elevationGainM: 2200,
        priority: 'A',
        status: 'confirmed',
      })
    } finally {
      sqlite.close()
    }
  })

  it('enforces competition structural checks in SQLite', () => {
    const sqlite = databaseWithPlan()
    migrateCompetitionEntriesSqlite(sqlite)

    const statement = sqlite.prepare(`
      INSERT INTO competition_entries (
        id, group_training_plan_id, name, date, distance_km,
        elevation_gain_m, priority, status, created_at, updated_at
      ) VALUES (?, 'plan-1', ?, '2027-04-10', ?, ?, ?, ?, 'created', 'updated')
    `)

    try {
      assert.throws(() => statement.run('bad-name', '   ', 42, 0, 'A', 'planned'))
      assert.throws(() => statement.run('bad-distance', 'Race', 0, 0, 'A', 'planned'))
      assert.throws(() => statement.run('bad-elevation', 'Race', 42, -1, 'A', 'planned'))
      assert.throws(() => statement.run('bad-priority', 'Race', 42, 0, 'D', 'planned'))
      assert.throws(() => statement.run('bad-status', 'Race', 42, 0, 'A', 'scheduled'))
    } finally {
      sqlite.close()
    }
  })

  it('enforces plan ownership and cascades entries when the plan is deleted', () => {
    const sqlite = databaseWithPlan()
    migrateCompetitionEntriesSqlite(sqlite)

    try {
      const invalidOwner = sqlite.prepare(`
        INSERT INTO competition_entries (
          id, group_training_plan_id, name, date, distance_km,
          priority, status, created_at, updated_at
        ) VALUES (
          'foreign', 'missing-plan', 'Race', '2027-04-10', 21,
          'B', 'planned', 'created', 'updated'
        )
      `)

      assert.throws(() => invalidOwner.run())

      insertCompetition(sqlite)
      sqlite.prepare(`DELETE FROM group_training_plans WHERE id = 'plan-1'`).run()

      const count = sqlite.prepare('SELECT count(*) AS count FROM competition_entries').get() as {
        count: number
      }
      assert.equal(count.count, 0)
    } finally {
      sqlite.close()
    }
  })

  it('creates the expected calendar indexes without a global A-priority unique index', () => {
    const sqlite = databaseWithPlan()
    migrateCompetitionEntriesSqlite(sqlite)

    try {
      const indexes = sqlite.prepare(`PRAGMA index_list('competition_entries')`).all() as Array<{
        name: string
        unique: number
      }>

      assert.ok(indexes.some(({ name }) => name === 'competition_entries_plan_date_idx'))
      assert.ok(indexes.some(({ name }) => name === 'competition_entries_plan_status_date_idx'))
      assert.equal(
        indexes.some(({ name, unique }) => name.includes('priority') && unique === 1),
        false,
      )
    } finally {
      sqlite.close()
    }
  })
})
