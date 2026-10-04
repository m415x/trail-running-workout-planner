import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

import { migrateKan615Historical0015 } from './kan-615-historical-0015'
import { seedKan615PreservationData } from './kan-615-preservation-seed'
import {
  assertAthleteProfileVersionedOriginSqlite,
  migrateAthleteProfileIdentitySqlite,
} from '../../db/migrations/athlete-profile-identity-sqlite'

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
] as const

function snapshotDependents(sqlite: Database.Database) {
  return Object.fromEntries(
    dependentTables.map(table => [
      table,
      sqlite.prepare(
        `SELECT * FROM "${table}" ORDER BY rowid`,
      ).all(),
    ]),
  )
}

test('KAN-615 commits identity and all twelve references with canonical 0016', () => {
  const sqlite = new Database(':memory:')

  try {
    sqlite.pragma('foreign_keys = ON')
    migrateKan615Historical0015(sqlite)
    assertAthleteProfileVersionedOriginSqlite(sqlite)
    seedKan615PreservationData(sqlite)

    const before = snapshotDependents(sqlite)

    assert.ok(
      dependentTables.every(table =>
        (before[table] as unknown[]).length === 1
      ),
      'All twelve incoming references must be populated',
    )

    const historyBefore = sqlite.prepare(`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all()

    assert.equal(historyBefore.length, 16)

    migrateAthleteProfileIdentitySqlite(sqlite)

    assert.deepEqual(snapshotDependents(sqlite), before)

    const athlete = sqlite.prepare(`
      SELECT id, user_id, team_id, dni,
             first_name, last_name, contact_email
      FROM athlete_profiles WHERE id = ?
    `).get('athlete-1') as Record<string, unknown>

    assert.equal(athlete.id, 'athlete-1')
    assert.equal(athlete.user_id, 'user-1')
    assert.equal(athlete.team_id, 'team-1')
    assert.equal(athlete.dni, '123')
    assert.equal(athlete.first_name, 'Ana')
    assert.equal(athlete.last_name, 'Runner')
    assert.equal(athlete.contact_email, 'runner@example.test')

    const columns = sqlite.pragma(
      'table_info(athlete_profiles)',
    ) as Array<{ name: string; notnull: number }>

    assert.equal(
      columns.find(column => column.name === 'user_id')?.notnull,
      0,
    )

    const journal = JSON.parse(
      readFileSync('drizzle/sqlite/meta/_journal.json', 'utf8'),
    ) as {
      entries: Array<{ tag: string; when: number }>
    }

    assert.equal(journal.entries.length, 17)

    const latest = journal.entries.at(-1)
    assert.ok(latest)
    assert.ok(
      latest.tag.startsWith('0016_'),
      'Expected canonical AthleteProfile 0016 migration',
    )

    const canonicalSql = readFileSync(
      `drizzle/sqlite/${latest.tag}.sql`,
      'utf8',
    )

    const expectedHash = createHash('sha256')
      .update(canonicalSql)
      .digest('hex')

    const historyAfter = sqlite.prepare(`
      SELECT hash, created_at
      FROM __drizzle_migrations
      ORDER BY rowid
    `).all() as Array<{ hash: string; created_at: number }>

    assert.equal(historyAfter.length, 17)
    assert.deepEqual(historyAfter.slice(0, 16), historyBefore)
    assert.deepEqual(historyAfter[16], {
      hash: expectedHash,
      created_at: latest.when,
    })

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
