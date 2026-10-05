import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import Database from 'better-sqlite3'

import { seedKan615PreservationData } from './kan-615-preservation-seed'

import {
  assertAthleteProfileVersionedOriginSqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 builds valid historical 0015 preservation parents', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    migrateKan615Historical0015(sqlite)

    assertAthleteProfileVersionedOriginSqlite(sqlite)




    // Twelve historical incoming AthleteProfile references.


    seedKan615PreservationData(sqlite)

    const dependentTables = [
      'athlete_billing_terms',
      'athlete_session_adjustments',
      'field_performance_tests',
      'group_history_records',
      'memberships',
      'monthly_charges',
      'physiology_records',
      'planning_cohort_memberships',
      'readiness_evaluations',
      'shoes',
      'training_goals',
      'workout_logs',
    ]

    for (const table of dependentTables) {
      const result = sqlite.prepare(
        `SELECT COUNT(*) AS count FROM "${table}"`
      ).get() as { count: number }

      assert.equal(result.count, 1, table)
    }


    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])

    const athlete = sqlite.prepare(`
      SELECT id, user_id, team_id
      FROM athlete_profiles
      WHERE id = 'athlete-1'
    `).get()

    assert.deepEqual(athlete, {
      id: 'athlete-1',
      user_id: 'user-1',
      team_id: 'team-1',
    })

    for (const table of [
      'planning_cohorts',
      'group_training_plans',
      'macrocycles',
      'mesocycles',
      'microcycles',
      'sessions',
      'group_session_prescriptions',
      'competition_entries',
    ]) {
      const row = sqlite.prepare(
        `SELECT COUNT(*) AS count FROM "${table}"`
      ).get() as { count: number }

      assert.equal(row.count, 1, table)
    }

    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
  } finally {
    sqlite.close()
  }
})
