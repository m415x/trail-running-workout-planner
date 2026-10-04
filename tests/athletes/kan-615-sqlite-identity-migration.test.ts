import assert from 'node:assert/strict'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateAthleteProfileIdentitySqlite } from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 preserves an existing athlete and workout while changing identity constraints', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    migrateKan615Historical0015(sqlite)

    sqlite.exec(`
      INSERT INTO teams (id, created_at, updated_at, name)
      VALUES ('team-1', 'now', 'now', 'Team');

      INSERT INTO users (
        id, created_at, updated_at, user_name,
        email, first_name, last_name
      ) VALUES (
        'user-1', 'now', 'now', 'runner',
        'runner@example.test', 'Ana', 'Runner'
      );

      INSERT INTO athlete_profiles (
        id, created_at, updated_at, user_id, team_id, dni
      ) VALUES (
        'athlete-1', 'now', 'now', 'user-1', 'team-1', '123'
      );

      INSERT INTO workout_logs (
        id, created_at, updated_at, athlete_id,
        date, duration_min, logged_at
      ) VALUES (
        'workout-1', 'now', 'now', 'athlete-1',
        '2026-09-22', 45, '2026-09-22T12:00:00Z'
      );
    `)

    migrateAthleteProfileIdentitySqlite(sqlite)

    const athlete = sqlite.prepare(`
      SELECT id, user_id, team_id, dni,
             first_name, last_name, contact_email
      FROM athlete_profiles
      WHERE id = 'athlete-1'
    `).get() as Record<string, unknown>

    assert.equal(athlete.id, 'athlete-1')
    assert.equal(athlete.user_id, 'user-1')
    assert.equal(athlete.team_id, 'team-1')
    assert.equal(athlete.dni, '123')

    const workout = sqlite.prepare(`
      SELECT id, athlete_id
      FROM workout_logs
      WHERE id = 'workout-1'
    `).get()

    assert.deepEqual(workout, {
      id: 'workout-1',
      athlete_id: 'athlete-1',
    })

    const columns = sqlite.pragma(
      'table_info(athlete_profiles)'
    ) as Array<{ name: string; notnull: number }>

    assert.equal(
      columns.find(column => column.name === 'user_id')?.notnull,
      0
    )

    assert.equal(sqlite.pragma('foreign_keys', { simple: true }), 1)
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
