import assert from 'node:assert/strict'
import test from 'node:test'
import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import Database from 'better-sqlite3'

import {
  assertAthleteProfileVersionedOriginSqlite,
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

test('KAN-615 migrates legitimate 0015 preserving athlete identity', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')

    migrateKan615Historical0015(sqlite)

    assertAthleteProfileVersionedOriginSqlite(sqlite)

    sqlite.exec(`
      INSERT INTO teams (id, created_at, updated_at, name)
      VALUES ('team-1', 'now', 'now', 'Team');

      INSERT INTO users (
        id, created_at, updated_at,
        user_name, email, first_name, last_name
      ) VALUES (
        'user-1', 'now', 'now',
        'runner', 'runner@example.test', 'Ana', 'Runner'
      );

      INSERT INTO athlete_profiles (
        id, created_at, updated_at,
        user_id, team_id, dni
      ) VALUES (
        'athlete-1', 'now', 'now',
        'user-1', 'team-1', '123'
      );
    `)

    const original = sqlite.prepare(`
      SELECT id, user_id, team_id, dni
      FROM athlete_profiles
      WHERE id = 'athlete-1'
    `).get()

    assert.deepEqual(original, {
      id: 'athlete-1',
      user_id: 'user-1',
      team_id: 'team-1',
      dni: '123',
    })

    migrateAthleteProfileIdentitySqlite(sqlite)

    const migrated = sqlite.prepare(`
      SELECT id, user_id, team_id, dni,
             first_name, last_name, contact_email
      FROM athlete_profiles
      WHERE id = 'athlete-1'
    `).get() as Record<string, unknown>

    assert.equal(migrated.id, 'athlete-1')
    assert.equal(migrated.user_id, 'user-1')
    assert.equal(migrated.team_id, 'team-1')
    assert.equal(migrated.dni, '123')

    assert.equal(migrated.first_name, 'Ana')
    assert.equal(migrated.last_name, 'Runner')
    assert.equal(migrated.contact_email, 'runner@example.test')

    const columns = sqlite.pragma(
      'table_info(athlete_profiles)',
    ) as Array<{
      name: string
      notnull: number
    }>

    assert.equal(
      columns.find(column => column.name === 'user_id')?.notnull,
      0,
    )

    assert.equal(sqlite.inTransaction, false)
    assert.equal(
      sqlite.pragma('foreign_keys', { simple: true }),
      1,
    )
    assert.deepEqual(sqlite.pragma('foreign_key_check'), [])
  } finally {
    sqlite.close()
  }
})
