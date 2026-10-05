import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import Database from 'better-sqlite3'

import { seedKan615PreservationData } from './kan-615-preservation-seed'

import {
  assertAthleteProfileVersionedOriginSqlite,
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

type FailurePoint = 'afterCopy' | 'beforeMetadata'

function fixture(
  executedSql: string[],
): Database.Database {
  const sqlite = new Database(":memory:", {
    verbose: statement => {
      if (typeof statement !== 'string') {
        throw new TypeError('Expected SQL trace statement')
      }
      executedSql.push(statement)
    },
  })

  try {
    sqlite.pragma('foreign_keys = ON')

    migrateKan615Historical0015(sqlite)

    assertAthleteProfileVersionedOriginSqlite(sqlite)

    seedKan615PreservationData(sqlite)

    return sqlite
  } catch (error) {
    sqlite.close()
    throw error
  }
}

function snapshot(sqlite: Database.Database) {
  return {
    schema: sqlite.prepare(`
      SELECT type, name, tbl_name, sql
      FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type, name
    `).all(),

    migrations: sqlite.prepare(`
      SELECT rowid, id, hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all(),


    dependents: Object.fromEntries(
      [
      "athlete_billing_terms",
      "athlete_session_adjustments",
      "field_performance_tests",
      "group_history_records",
      "memberships",
      "monthly_charges",
      "physiology_records",
      "planning_cohort_memberships",
      "readiness_evaluations",
      "shoes",
      "training_goals",
      "workout_logs"
].map(table => [
        table,
        sqlite.prepare(
          `SELECT * FROM "${table}" ORDER BY rowid`
        ).all(),
      ]),
    ),

    athletes: sqlite.prepare(`
      SELECT *
      FROM athlete_profiles
      ORDER BY id
    `).all(),
  }
}

for (const failAt of [
  'afterCopy',
  'beforeMetadata',
] as const satisfies readonly FailurePoint[]) {
  test(`KAN-615 rolls back completely on ${failAt}`, () => {
    const executedSql: string[] = []
    const sqlite = fixture(executedSql)

    try {
      const before = snapshot(sqlite)
      executedSql.length = 0

      // Contrato de inyección reservado al ejecutor KAN-615.
      // No será un sistema genérico de hooks de migración.
      assert.throws(
        () => migrateAthleteProfileIdentitySqlite(
          sqlite,
          { failAt },
        ),
        error =>
          error instanceof Error &&
          !(error instanceof TypeError) &&
          error.message === `KAN615_INJECTED_${failAt}`,
        `Expected controlled failure at ${failAt}`,
      )

      const executedCopy = executedSql.some(statement =>
        /INSERT\s+INTO\s+["`]?__new_athlete_profiles["`]?/i
          .test(statement)
      )

      assert.equal(
        executedCopy,
        true,
        "The injected failure must occur after a real athlete copy",
      )

      assert.deepEqual(snapshot(sqlite), before)

      assert.equal(sqlite.inTransaction, false)
      assert.equal(
        sqlite.pragma('foreign_keys', { simple: true }),
        1,
      )
      assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

      // Sigue siendo reconocible como origen 0015:
      // no se consumió ni falsificó la migración.
      assertAthleteProfileVersionedOriginSqlite(sqlite)
    } finally {
      sqlite.close()
    }
  })
}
